# Project Goals & Instructions

> **Purpose:** This document describes the long-term vision, user flows, and
> technical architecture for the **Documentation** app. Refer to it when making
> design or implementation decisions so every change stays aligned with the
> overall goals.

---

## 1. Vision

Build a mobile-first app for **construction companies** that lets field workers
capture and upload site photos effortlessly, while giving managers a browser-based
dashboard to review all submitted documentation.

### Core principles

| Principle | Why it matters |
|---|---|
| **Fast startup** | Field workers open the app dozens of times a day; every second counts. |
| **Offline-friendly** | Construction sites often have spotty connectivity. |
| **Automatic metadata** | GPS coordinates, timestamps, and user info should be attached without extra steps. |
| **Simple upload flow** | Take photos → auto-upload → get confirmation. Minimal taps. |

---

## 2. User Roles

| Role | Access | Description |
|---|---|---|
| **Field worker** | Mobile app (Android / iOS) | Takes photos on-site; sees upload confirmations. |
| **Manager / Admin** | Web dashboard (browser) | Views all submitted documentation; manages construction sites. |

---

## 3. User Flows

### 3.1 Field Worker (Mobile)

1. Open the app — it loads quickly.
2. Authenticate via **Microsoft (Entra ID / MSAL)** before seeing the main UI.
3. Take **one or several** photos on a construction site.
4. Photos are **automatically uploaded** in the background.
5. Receive a **confirmation** that each upload succeeded.

### 3.2 Manager / Admin (Web Dashboard)

1. Open the dashboard in a browser.
2. Authenticate via Microsoft.
3. Browse and search all submitted photo documentation.
4. View photo details: image, GPS location, timestamp, uploader, associated
   construction site.

### 3.3 Admin Panel

1. Create and edit **construction site** records.
2. Plot or enter site **coordinates** (map-based or manual input).
3. GPS-tagged photos are automatically associated with the nearest / matching
   construction site.

---

## 4. Technical Architecture

### 4.1 Mobile App

| Layer | Technology |
|---|---|
| Runtime | **Capacitor 8** webview app (`com.himmelfisk.documentation`) |
| Platforms | Android, iOS |
| Web source | `www/` directory, synced via `npx cap sync` |
| Camera | `@capacitor/camera` plugin |
| Geolocation | `@capacitor/geolocation` (to be added) |
| Auth | **MSAL.js** — Microsoft identity platform |

### 4.2 Backend / Cloud

| Component | Technology | Purpose |
|---|---|---|
| Image storage | **Cloudflare R2** | Store uploaded photos (S3-compatible object storage). |
| Metadata DB | **Cloudflare D1** | Store photo metadata — GPS coordinates, timestamp, uploader, site association, R2 object key. |
| API | **Cloudflare Workers** | Endpoints for upload, authentication verification, and dashboard queries. |

### 4.3 Web Dashboard

| Aspect | Notes |
|---|---|
| Hosting | Cloudflare Pages or served from a Worker |
| Auth | Microsoft (same tenant / app registration as the mobile app) |
| Features | Browse photos, view on map, filter by site / date / worker |

---

## 5. Data Model (High-Level)

### `photos` table (D1)

| Column | Type | Description |
|---|---|---|
| `id` | TEXT (UUID) | Primary key |
| `r2_key` | TEXT | Object key in R2 |
| `uploader_id` | TEXT | Microsoft user ID |
| `latitude` | REAL | GPS latitude |
| `longitude` | REAL | GPS longitude |
| `captured_at` | TEXT (ISO 8601) | When the photo was taken |
| `uploaded_at` | TEXT (ISO 8601) | When the upload completed |
| `site_id` | TEXT | FK → `sites.id` (nullable until matched) |

### `sites` table (D1)

| Column | Type | Description |
|---|---|---|
| `id` | TEXT (UUID) | Primary key |
| `name` | TEXT | Human-readable site name |
| `latitude` | REAL | Center-point latitude |
| `longitude` | REAL | Center-point longitude |
| `radius_m` | REAL | Geofence radius in meters |
| `created_at` | TEXT (ISO 8601) | When the record was created |

---

## 6. Implementation Milestones

The items below are ordered roughly by priority. Each milestone should result in
a working, testable increment.

- [x] **M1 — Project scaffold** — Capacitor app with camera capture.
- [ ] **M2 — Microsoft authentication** — MSAL login gate; no UI until
      authenticated.
- [ ] **M3 — Geolocation capture** — Attach GPS coordinates to each photo.
- [ ] **M4 — Cloudflare backend** — Workers API, R2 bucket, D1 database.
- [ ] **M5 — Photo upload & confirmation** — Auto-upload with progress/status
      feedback.
- [ ] **M6 — Web dashboard (read-only)** — Managers can view uploaded photos in
      a browser.
- [ ] **M7 — Admin panel** — Create/edit construction sites with map
      coordinates.
- [ ] **M8 — Auto-association** — Match photos to sites based on GPS proximity.
- [ ] **M9 — Offline support** — Queue uploads when offline; sync when back
      online.
- [ ] **M10 — Polish & production** — Performance tuning, error handling, app
      store readiness.

---

## 7. Code Quality & Structure Guidelines

- Keep the `www/` directory as the single source of truth for all web assets.
- Use **ES modules** (`type="module"`) for JavaScript.
- Prefer small, focused files over large monoliths — e.g., separate modules for
  auth, camera, upload, and geolocation logic.
- Follow the existing CSS conventions (CSS custom properties, system font stack,
  dark-mode media query).
- Run `npx cap sync` after every change to `www/` before testing on device.
- Document any new Capacitor plugin or Cloudflare service in this file and in the
  README.
