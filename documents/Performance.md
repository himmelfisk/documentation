# Performance Analysis Under Heavy Load

This document analyzes the performance characteristics of the Documentation app under heavy load, covering every layer of the stack: the Cloudflare Worker API, D1 database, R2 object storage, Microsoft Entra ID authentication, and the Capacitor mobile client.

---

## Architecture Overview

| Layer | Technology | Role |
|-------|-----------|------|
| Mobile client | Capacitor (iOS / Android) + vanilla JS | Camera capture, EXIF extraction, image upload |
| Authentication | Microsoft Entra ID (MSAL.js v5, redirect flow) | JWT-based identity; tenant isolation via `tid` claim |
| API gateway | Cloudflare Worker (`worker/src/index.js`) | Request routing, JWT validation, business logic |
| Database | Cloudflare D1 (SQLite-based) | Photo metadata and site records |
| Object storage | Cloudflare R2 | Full-resolution photo images |

All requests flow: **Mobile app → Cloudflare Worker → D1 / R2**.

---

## 1. Cloudflare Worker (Compute)

### How It Scales

Cloudflare Workers run on V8 isolates distributed across 300+ edge locations. Each incoming request is handled by an isolate in the nearest data center. There is no single origin server — the platform auto-scales horizontally.

**Strengths under load:**
- Automatic horizontal scaling — no provisioning, no cold-start VMs.
- Sub-millisecond isolate startup (V8 isolates, not containers).
- Requests are geographically distributed; load is spread across the global network.

**Limits (per the Workers platform):**
| Metric | Free plan | Paid plan |
|--------|-----------|-----------|
| Requests/day | 100,000 | Unlimited (billed) |
| CPU time/request | 10 ms | 30 ms (up to 15 min with Cron) |
| Memory/isolate | 128 MB | 128 MB |
| Subrequest limit | 50 | 1,000 |

### Identified Bottlenecks

1. **JWT validation on every request.** The `authenticate()` function calls `jwtVerify()` against Microsoft's remote JWKS endpoint on every API request. The `jose` library's `createRemoteJWKSet()` caches the key set within a single isolate's lifetime, but each new isolate (new edge location or eviction) triggers a fresh HTTPS fetch to `login.microsoftonline.com`. Under burst traffic, many isolates spinning up simultaneously will each independently fetch the JWKS, adding ~50–200 ms of latency per cold-start request.

2. **No request-level caching.** `GET /api/photos` and `GET /api/sites` hit D1 on every call. There is no `Cache-Control` header on JSON responses and no use of the Cloudflare Cache API. Under read-heavy traffic, every request results in a D1 round-trip.

3. **Unbounded result sets.** `GET /api/photos` returns *all* photos for a tenant in a single query (`ORDER BY created DESC` with no `LIMIT`). A tenant with thousands of photos will produce a large JSON payload on every request, consuming CPU time for serialization and bandwidth.

4. **FormData parsing in memory.** `POST /api/photos` calls `request.formData()`, which buffers the entire multipart body — including the image — into Worker memory. Mobile photos are typically 3–10 MB (JPEG quality 90). At 128 MB per isolate, concurrent uploads in the same isolate are constrained.

5. **Global variable `sitesTableReady`.** The `let sitesTableReady = false` flag is scoped to a single isolate. Each new isolate runs the `CREATE TABLE IF NOT EXISTS` DDL before the first sites query. Under high concurrency this means many simultaneous DDL statements hit D1, though SQLite handles idempotent DDL gracefully.

---

## 2. Cloudflare D1 (Database)

### How It Scales

D1 is built on SQLite with Cloudflare's distributed storage layer. It provides:
- **Read replicas** at the edge — read queries are fast and geographically local.
- **Single primary writer** — all writes are serialized through a single leader.

### Identified Bottlenecks

1. **Write serialization.** Every `POST /api/photos`, `POST /api/sites`, `PUT /api/sites/:id`, and `DELETE /api/sites/:id` is a write operation routed to the single primary. Under heavy concurrent uploads (e.g., multiple field teams submitting photos simultaneously), writes queue up. D1's write throughput is roughly **10,000–30,000 writes/second** in practice, but latency per write increases under contention.

2. **No indexes beyond the primary key.** The `documentation` table is queried with `WHERE tenant_id = ? ORDER BY created DESC` but there is no explicit composite index on `(tenant_id, created)`. As the table grows, this query degrades from an index scan to a full table scan filtered in SQLite. The same applies to the `sites` table.

3. **Inline DDL migration.** The `ALTER TABLE` migration in `ensureSitesTable()` runs on every isolate's first sites request. While idempotent, under a burst of new isolates this generates redundant DDL traffic to the D1 primary.

4. **No connection pooling or batching.** Each Worker request opens a fresh D1 binding. There is no query batching — a photo upload is one INSERT, a site list is one SELECT. Batch operations (e.g., `D1Database.batch()`) are not used.

### Recommendations

| Issue | Recommendation | Effort |
|-------|---------------|--------|
| Missing indexes | `CREATE INDEX idx_docs_tenant_created ON documentation(tenant_id, created DESC)` | Low |
| Unbounded queries | Add `LIMIT` + cursor-based pagination to `GET /api/photos` | Medium |
| Write contention | Acceptable at current scale; monitor D1 metrics. At higher scale, consider write buffering via Queues | Future |
| DDL on every isolate | Move schema migrations to a Wrangler `migrations/` directory | Low |

---

## 3. Cloudflare R2 (Object Storage)

### How It Scales

R2 is S3-compatible object storage with no egress fees. It is designed for high-throughput reads and writes.

**Strengths:**
- No rate limits on `PUT` or `GET` operations for standard usage.
- Objects are replicated and served from the nearest edge.
- Streaming upload via `imageFile.stream()` avoids buffering the entire file in R2's ingestion layer.

### Identified Bottlenecks

1. **Upload size is uncapped.** The Worker does not enforce a maximum file size before calling `env.BUCKET.put()`. Cloudflare Workers have a **100 MB request body limit** (paid plan), but even a 50 MB image will consume significant memory and CPU during FormData parsing.

2. **No content-type validation.** The Worker maps MIME types to extensions (`mimeExtMap`) but does not reject non-image content. A malicious client could upload arbitrary data.

3. **Image serving bypasses CDN caching.** `GET /api/photos/image/:tenantId/:filename` does set `Cache-Control: public, max-age=31536000, immutable`, which is excellent. However, because the route requires authentication (Bearer token), Cloudflare's CDN layer will not cache the response by default — authenticated responses are treated as private. Each image request hits R2 directly.

### Recommendations

| Issue | Recommendation | Effort |
|-------|---------------|--------|
| Uncapped upload size | Check `imageFile.size` before `BUCKET.put()` and reject uploads > 15 MB | Low |
| No content validation | Validate `imageFile.type` against the allowlist before upload | Low |
| CDN bypass on images | Serve images via a separate unauthenticated route with signed URLs (time-limited), enabling CDN caching | Medium |

---

## 4. Authentication (Microsoft Entra ID / MSAL)

### How It Scales

MSAL authentication happens client-side. The Worker only validates the JWT — it does not participate in the OAuth flow.

### Identified Bottlenecks

1. **JWKS cold-start latency.** As noted in §1, each new isolate fetches the JWKS from Microsoft. Under a traffic spike that spawns many new isolates globally, this creates a burst of outbound HTTPS requests to `login.microsoftonline.com`. Microsoft's JWKS endpoint is highly available but adds 50–200 ms latency per cold start.

2. **No token caching across requests.** Each request independently validates its JWT. While `jwtVerify()` is fast (~1–2 ms with cached keys), the overhead is non-zero. Workers KV or an in-memory LRU cache of recently-validated token hashes could skip re-verification for repeated tokens within a short window.

3. **Clock tolerance is generous.** `clockTolerance: 300` (5 minutes) is reasonable for mobile clock drift but widens the window for replayed tokens.

### Recommendations

| Issue | Recommendation | Effort |
|-------|---------------|--------|
| JWKS cold start | Pre-warm JWKS via a Cron Trigger that runs `createRemoteJWKSet()` every 5 min | Low |
| Token re-validation | Cache validated token `jti` claims in a per-isolate Map with short TTL | Low |
| Clock tolerance | Acceptable trade-off for mobile use; no change needed | — |

---

## 5. Frontend / Mobile Client

### Performance Under Load Scenarios

The mobile client is a single-user app — "heavy load" on the client means rapid sequential photo captures and uploads, not concurrent users.

### Identified Bottlenecks

1. **Sequential upload.** Photos are uploaded one at a time. If a user captures 10 photos in quick succession, each upload waits for the previous one to complete. There is no upload queue or background sync.

2. **Double image fetch.** The image blob is fetched once via `fetch(imageSrc)` for upload, and separately by ExifReader for EXIF parsing. This means the same multi-MB image is read from disk twice.

3. **EXIF + GPS in parallel (good).** `collectGeotagData()` runs EXIF extraction and device GPS acquisition in parallel via `Promise.all()`, which is already optimal.

4. **Bundle size.** The app uses `exifreader` (150+ KB) and `@azure/msal-browser` (200+ KB) bundled via esbuild. On slow mobile networks, the initial load of `app.js` may be significant.

5. **No offline support.** If the upload fails (network error), the photo and metadata are lost. There is no local persistence or retry queue.

### Recommendations

| Issue | Recommendation | Effort |
|-------|---------------|--------|
| Sequential uploads | Implement an upload queue with `navigator.serviceWorker` or Capacitor background task | High |
| Double image read | Read the blob once and pass the `ArrayBuffer` to both ExifReader and the FormData upload | Low |
| No offline support | Use IndexedDB to queue failed uploads for retry | Medium |
| Bundle size | Enable esbuild tree-shaking; lazy-load ExifReader only when camera is used | Low |

---

## 6. Load Profile Estimates

Based on the architecture, here are estimated throughput limits:

| Scenario | Estimated Capacity | Limiting Factor |
|----------|-------------------|-----------------|
| Concurrent photo uploads | ~500–1,000 req/s | D1 write serialization |
| Concurrent photo reads (list) | ~5,000–10,000 req/s | D1 read replicas, but unbounded payloads |
| Concurrent image serves | ~10,000+ req/s | R2 throughput (would be higher with CDN caching) |
| Authentication overhead | ~1–2 ms/req (warm), ~200 ms/req (cold JWKS) | JWKS fetch on isolate cold start |
| Concurrent site CRUD | ~500–1,000 req/s | D1 write serialization (shared writer) |

### Cost Projections (Workers Paid Plan)

| Resource | Unit Cost | 10K uploads/day | 100K uploads/day |
|----------|-----------|-----------------|-------------------|
| Worker requests | $0.30/M requests | $0.09/mo | $0.90/mo |
| D1 reads | $0.001/M rows | ~$0.03/mo | ~$0.30/mo |
| D1 writes | $1.00/M rows | $0.30/mo | $3.00/mo |
| R2 storage | $0.015/GB/mo | ~$1.50/mo (10 GB) | ~$15/mo (100 GB) |
| R2 operations | $0.36/M Class A | $0.11/mo | $1.08/mo |

---

## 7. Summary of Recommendations (Priority Order)

### Quick Wins (Low Effort, High Impact)

1. **Add database indexes** on `(tenant_id, created)` for both tables.
2. **Add pagination** (`LIMIT` + offset/cursor) to `GET /api/photos`.
3. **Cap upload size** — reject images larger than 15 MB before R2 upload.
4. **Reuse the image buffer** — read once, pass to both ExifReader and FormData.

### Medium-Term Improvements

5. **Signed image URLs** — serve images via unauthenticated signed URLs so Cloudflare's CDN can cache them.
6. **Offline upload queue** — persist pending uploads in IndexedDB for retry.
7. **Schema migrations** — move DDL to Wrangler's `migrations/` directory.

### Future Considerations

8. **Write buffering** via Cloudflare Queues for photo uploads under extreme write load.
9. **Background upload** via Capacitor background tasks for uninterrupted field use.
10. **Rate limiting** — add per-tenant rate limits to prevent abuse (currently no rate limiting on any endpoint).

---

## 8. Conclusion

The current architecture is well-suited for its use case: field teams capturing and uploading construction site photos. Cloudflare's edge platform provides automatic scaling, low latency, and cost-effective storage.

The primary performance risks under heavy load are:

- **D1 write serialization** — the single-writer model limits concurrent photo uploads to ~500–1,000/s, which is adequate for hundreds of concurrent users but would require buffering at larger scale.
- **Unbounded queries** — the lack of pagination on photo listings will degrade as tenants accumulate thousands of records.
- **Image serving without CDN caching** — authenticated image routes bypass Cloudflare's cache layer, meaning every image view hits R2 directly.

None of these are critical at the app's current scale, but addressing the quick wins (indexes, pagination, upload size cap) will provide significant headroom for growth.
