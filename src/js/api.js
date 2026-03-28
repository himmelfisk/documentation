/**
 * API client — communicates with the Cloudflare Worker backend.
 *
 * The worker URL must be updated after deployment.  Run
 *   cd worker && npx wrangler deploy
 * and paste the URL below.
 */

import { getIdToken } from './auth.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Base URL of the deployed Cloudflare Worker.
 *
 * After running `cd worker && npx wrangler deploy`, Wrangler prints
 * the live URL — paste it here (without trailing slash).
 *
 * Example: 'https://documentation-api.your-subdomain.workers.dev'
 */
const API_BASE = 'https://documentation-api.himmelfisk.workers.dev';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit photo metadata to the backend.
 *
 * @param {object} opts
 * @param {number|null} opts.latitude
 * @param {number|null} opts.longitude
 * @param {string|null} opts.capturedAt  ISO 8601 timestamp
 * @returns {Promise<{success: boolean}>}
 */
export async function submitPhotoMetadata({ latitude, longitude, capturedAt }) {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated — cannot submit metadata.');
  }

  const imagelocation =
    latitude != null && longitude != null
      ? `${latitude},${longitude}`
      : '';

  const response = await fetch(`${API_BASE}/api/photos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imagelocation,
      created: capturedAt || new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed (HTTP ${response.status})`);
  }

  return response.json();
}
