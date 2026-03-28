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
const API_BASE = 'https://documentation-api.k-a-lorgen.workers.dev';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a photo (image + metadata) to the backend.
 *
 * The image is uploaded to R2 storage and the metadata (location,
 * timestamp) is stored in D1.  If no imageBlob is provided the request
 * falls back to a JSON-only metadata submission.
 *
 * @param {object} opts
 * @param {number|null} opts.latitude
 * @param {number|null} opts.longitude
 * @param {string|null} opts.capturedAt  ISO 8601 timestamp
 * @param {Blob|null}   opts.imageBlob   Photo image data
 * @returns {Promise<{success: boolean, imageUrl?: string}>}
 */
export async function submitPhoto({ latitude, longitude, capturedAt, imageBlob }) {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated — cannot submit photo.');
  }

  const imagelocation =
    latitude != null && longitude != null
      ? `${latitude},${longitude}`
      : '';

  const metadata = JSON.stringify({
    imagelocation,
    created: capturedAt || new Date().toISOString(),
  });

  let response;

  if (imageBlob) {
    // ── FormData upload (image + metadata) ──
    const ext = imageBlob.type === 'image/png' ? 'png' : 'jpg';
    const formData = new FormData();
    formData.append('image', imageBlob, `photo.${ext}`);
    formData.append('metadata', metadata);

    response = await fetch(`${API_BASE}/api/photos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Content-Type is set automatically by the browser for FormData
      },
      body: formData,
    });
  } else {
    // ── JSON-only fallback (no image) ──
    response = await fetch(`${API_BASE}/api/photos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: metadata,
    });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed (HTTP ${response.status})`);
  }

  return response.json();
}
