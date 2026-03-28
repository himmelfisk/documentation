/**
 * Cloudflare Worker — Documentation API
 *
 * Receives photo metadata from the mobile app, validates the caller's
 * Microsoft Entra ID token (JWT), and stores the record in D1.
 *
 * Security model:
 *   1. Every request must carry a valid MSAL ID-token in the
 *      Authorization header (Bearer <token>).
 *   2. The token signature is verified against Microsoft's published
 *      JWKS (JSON Web Key Set).
 *   3. The tenant_id used for data isolation comes from the validated
 *      token's `tid` claim — never from client-supplied parameters.
 *   4. Every D1 query is scoped to the authenticated tenant_id.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getAdminHtml } from './admin-html.js';
import { getDashboardHtml } from './dashboard-html.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Must match the Azure AD SPA app-registration client ID. */
const CLIENT_ID = '65702384-9248-47a3-80d9-bcf5abb69424';

/** Microsoft's public key endpoint for the /organizations authority. */
const JWKS_URL = new URL(
  'https://login.microsoftonline.com/organizations/discovery/v2.0/keys',
);

/** jose remote keyset — handles fetching and caching automatically. */
const jwks = createRemoteJWKSet(JWKS_URL);

/**
 * Table name in the D1 database.
 * SECURITY: This must remain a hardcoded string literal — never derived
 * from user input, request parameters, or environment variables.
 */
const TABLE = 'documentation';

/**
 * Table name for construction sites — separate from the photo metadata table.
 * SECURITY: Hardcoded string literal, never derived from user input.
 */
const SITES_TABLE = 'sites';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// JWT validation
// ---------------------------------------------------------------------------

/**
 * Validate the Bearer token on the request.
 *
 * @returns {Promise<import('jose').JWTPayload|null>}
 *   Decoded claims on success, null on any validation failure.
 */
async function authenticate(request) {
  const header = request.headers.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;

  try {
    const { payload } = await jwtVerify(header.slice(7), jwks, {
      audience: CLIENT_ID,
      clockTolerance: 300, // 5 min tolerance for mobile clock drift
    });

    // Issuer must be https://login.microsoftonline.com/{tid}/v2.0
    const iss = payload.iss || '';
    if (
      !iss.startsWith('https://login.microsoftonline.com/') ||
      !iss.endsWith('/v2.0')
    ) {
      return null;
    }

    // tid (tenant ID) is required for data isolation
    if (!payload.tid) return null;

    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/** POST /api/photos — upload photo + metadata for the authenticated tenant. */
async function handlePostPhoto(request, env, claims) {
  const contentType = request.headers.get('Content-Type') || '';
  const user = claims.name || 'Unknown';
  const tenantId = claims.tid;
  const now = new Date().toISOString();

  let imagelocation = '';
  let created = now;
  let imageUrl = '';

  if (contentType.includes('multipart/form-data')) {
    // ── FormData upload (image + metadata) ──
    const formData = await request.formData();
    const imageFile = formData.get('image');
    const metadataRaw = formData.get('metadata');

    let meta = {};
    if (metadataRaw) {
      try { meta = JSON.parse(metadataRaw); } catch { /* ignore */ }
    }

    imagelocation = typeof meta.imagelocation === 'string' ? meta.imagelocation : '';
    created = typeof meta.created === 'string' ? meta.created : now;

    if (imageFile && imageFile.size > 0) {
      const mimeExtMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
      const ext = mimeExtMap[imageFile.type] || 'jpg';
      const filename = `${crypto.randomUUID()}.${ext}`;
      const key = `${tenantId}/${filename}`;

      await env.BUCKET.put(key, imageFile.stream(), {
        httpMetadata: {
          contentType: imageFile.type || 'image/jpeg',
        },
      });

      const origin = new URL(request.url).origin;
      imageUrl = `${origin}/api/photos/image/${encodeURIComponent(tenantId)}/${filename}`;
    }
  } else {
    // ── JSON body (backwards-compatible) ──
    const body = await request.json();
    imagelocation = typeof body.imagelocation === 'string' ? body.imagelocation : '';
    created = typeof body.created === 'string' ? body.created : now;
  }

  await env.DB.prepare(
    `INSERT INTO ${TABLE} (user, imagelocation, created, modified, imageurl, tenant_id) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(user, imagelocation, created, now, imageUrl, tenantId)
    .run();

  return json({ success: true, imageUrl });
}

/** GET /api/photos — list photos scoped to the authenticated tenant. */
async function handleGetPhotos(env, claims) {
  const result = await env.DB.prepare(
    `SELECT rowid, user, imagelocation, created, modified, imageurl FROM ${TABLE} WHERE tenant_id = ? ORDER BY created DESC`,
  )
    .bind(claims.tid)
    .all();

  return json({ photos: result.results });
}

/**
 * GET /api/photos/image/:tenantId/:filename — serve an image from R2.
 *
 * The R2 key is `{tenantId}/{filename}`.  Access is restricted to the
 * authenticated tenant that owns the image.
 */
async function handleGetImage(env, claims, tenantId, filename) {
  // Only allow the owning tenant to access their images
  if (tenantId !== claims.tid) {
    return json({ error: 'Forbidden' }, 403);
  }

  // Validate filename — only allow uuid.ext pattern with known image extensions
  if (!/^[0-9a-f-]+\.(jpg|png|webp|gif)$/i.test(filename)) {
    return json({ error: 'Bad request' }, 400);
  }

  const key = `${tenantId}/${filename}`;
  const object = await env.BUCKET.get(key);
  if (!object) {
    return json({ error: 'Not found' }, 404);
  }

  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}

// ---------------------------------------------------------------------------
// Sites table helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the `sites` table exists (with the `tenant_id` column).
 * Called lazily on the first sites-related request so we don't run DDL on
 * every Worker invocation.
 */
let sitesTableReady = false;
async function ensureSitesTable(db) {
  if (sitesTableReady) return;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ${SITES_TABLE} (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    DEFAULT '',
      latitude    REAL,
      longitude   REAL,
      address     TEXT    DEFAULT '',
      created     TEXT    NOT NULL,
      modified    TEXT    NOT NULL,
      tenant_id   TEXT    DEFAULT ''
    )
  `).run();
  // Migration: add tenant_id to existing tables that lack it
  try {
    await db.prepare(
      `ALTER TABLE ${SITES_TABLE} ADD COLUMN tenant_id TEXT DEFAULT ''`,
    ).run();
  } catch (err) {
    // "duplicate column name" is expected after the first migration run.
    // Re-throw anything else so genuine DB errors aren't swallowed.
    if (!String(err).includes('duplicate column name')) throw err;
  }
  sitesTableReady = true;
}

// ---------------------------------------------------------------------------
// Sites route handlers  (authenticated — scoped to tenant)
// ---------------------------------------------------------------------------

/** GET /api/sites — list sites for the authenticated tenant. */
async function handleGetSites(env, claims) {
  await ensureSitesTable(env.DB);
  const result = await env.DB.prepare(
    `SELECT id, name, description, latitude, longitude, address, created, modified FROM ${SITES_TABLE} WHERE tenant_id = ? ORDER BY created DESC`,
  )
    .bind(claims.tid)
    .all();
  return json({ sites: result.results });
}

/** POST /api/sites — register a new site for the authenticated tenant. */
async function handlePostSite(request, env, claims) {
  await ensureSitesTable(env.DB);

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return json({ error: 'Site name is required' }, 400);
  }

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const latitude = typeof body.latitude === 'number' && isFinite(body.latitude) && body.latitude >= -90 && body.latitude <= 90 ? body.latitude : null;
  const longitude = typeof body.longitude === 'number' && isFinite(body.longitude) && body.longitude >= -180 && body.longitude <= 180 ? body.longitude : null;
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `INSERT INTO ${SITES_TABLE} (name, description, latitude, longitude, address, created, modified, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(name, description, latitude, longitude, address, now, now, claims.tid)
    .run();

  return json({ success: true, id: result.meta.last_row_id }, 201);
}

/** PUT /api/sites/:id — update an existing site (tenant-scoped). */
async function handlePutSite(request, env, siteId, claims) {
  await ensureSitesTable(env.DB);

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return json({ error: 'Site name is required' }, 400);
  }

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const latitude = typeof body.latitude === 'number' && isFinite(body.latitude) && body.latitude >= -90 && body.latitude <= 90 ? body.latitude : null;
  const longitude = typeof body.longitude === 'number' && isFinite(body.longitude) && body.longitude >= -180 && body.longitude <= 180 ? body.longitude : null;
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `UPDATE ${SITES_TABLE} SET name = ?, description = ?, latitude = ?, longitude = ?, address = ?, modified = ? WHERE id = ? AND tenant_id = ?`,
  )
    .bind(name, description, latitude, longitude, address, now, siteId, claims.tid)
    .run();

  if (result.meta.changes === 0) {
    return json({ error: 'Site not found' }, 404);
  }

  return json({ success: true });
}

/** DELETE /api/sites/:id — remove a site (tenant-scoped). */
async function handleDeleteSite(env, siteId, claims) {
  await ensureSitesTable(env.DB);

  const result = await env.DB.prepare(
    `DELETE FROM ${SITES_TABLE} WHERE id = ? AND tenant_id = ?`,
  )
    .bind(siteId, claims.tid)
    .run();

  if (result.meta.changes === 0) {
    return json({ error: 'Site not found' }, 404);
  }

  return json({ success: true });
}

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ---- Dashboard (no auth — MSAL handles login in-browser) ----
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(getDashboardHtml(url.origin), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
      });
    }

    // ---- Admin panel (no auth — MSAL handles login in-browser) ----
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return new Response(getAdminHtml(url.origin), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
      });
    }

    // ---- /api/me — user info + admin check ----
    if (url.pathname === '/api/me' && request.method === 'GET') {
      const claims = await authenticate(request);
      if (!claims) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const email = (claims.preferred_username || claims.email || '').toLowerCase();
      const adminList = (env.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
      const isAdmin = adminList.includes(email);

      return json({
        name: claims.name || '',
        email: email,
        tenantId: claims.tid,
        isAdmin,
      });
    }

    // ---- Sites API (authenticated — scoped to tenant) ----
    if (url.pathname === '/api/sites' || url.pathname.match(/^\/api\/sites\/\d+$/)) {
      const claims = await authenticate(request);
      if (!claims) {
        return json({ error: 'Unauthorized' }, 401);
      }

      try {
        if (url.pathname === '/api/sites' && request.method === 'GET') {
          return await handleGetSites(env, claims);
        }
        if (url.pathname === '/api/sites' && request.method === 'POST') {
          return await handlePostSite(request, env, claims);
        }

        const sitesMatch = url.pathname.match(/^\/api\/sites\/(\d+)$/);
        if (sitesMatch) {
          const siteId = parseInt(sitesMatch[1], 10);
          if (request.method === 'PUT') {
            return await handlePutSite(request, env, siteId, claims);
          }
          if (request.method === 'DELETE') {
            return await handleDeleteSite(env, siteId, claims);
          }
        }
      } catch (err) {
        console.error(`${request.method} ${url.pathname} failed:`, err);
        return json({ error: 'Internal server error' }, 500);
      }
    }

    // ---- Authenticated API routes (/api/*) ----
    if (!url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404);
    }

    // Authenticate every remaining API request
    const claims = await authenticate(request);
    if (!claims) {
      return json({ error: 'Unauthorized' }, 401);
    }

    try {
      // POST /api/photos
      if (url.pathname === '/api/photos' && request.method === 'POST') {
        return await handlePostPhoto(request, env, claims);
      }

      // GET /api/photos
      if (url.pathname === '/api/photos' && request.method === 'GET') {
        return await handleGetPhotos(env, claims);
      }

      // GET /api/photos/image/:tenantId/:filename
      const imageMatch = url.pathname.match(
        /^\/api\/photos\/image\/([^/]+)\/([^/]+)$/,
      );
      if (imageMatch && request.method === 'GET') {
        return await handleGetImage(
          env,
          claims,
          decodeURIComponent(imageMatch[1]),
          decodeURIComponent(imageMatch[2]),
        );
      }
    } catch (err) {
      console.error('Request failed:', err);
      return json({ error: 'Internal server error' }, 500);
    }

    return json({ error: 'Not found' }, 404);
  },
};
