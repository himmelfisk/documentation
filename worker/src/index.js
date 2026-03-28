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
 * This constant is never derived from user input.
 */
const TABLE = 'photos';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

/** POST /api/photos — store photo metadata for the authenticated tenant. */
async function handlePostPhoto(request, env, claims) {
  const body = await request.json();

  const user = claims.name || 'Unknown';
  const tenantId = claims.tid;
  const imagelocation = typeof body.imagelocation === 'string' ? body.imagelocation : '';
  const created = typeof body.created === 'string' ? body.created : new Date().toISOString();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO ${TABLE} (user, imagelocation, created, modified, tenant_id) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(user, imagelocation, created, now, tenantId)
    .run();

  return json({ success: true });
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

    // Only /api/* routes are handled
    if (!url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404);
    }

    // Authenticate every API request
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
    } catch (err) {
      console.error('Request failed:', err);
      return json({ error: 'Internal server error' }, 500);
    }

    return json({ error: 'Not found' }, 404);
  },
};
