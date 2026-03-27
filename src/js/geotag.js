import ExifReader from 'exifreader';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Convert an EXIF DateTimeOriginal string ("YYYY:MM:DD HH:MM:SS") to ISO 8601.
 * Returns null if the input cannot be parsed.
 *
 * @param {string} exifDateTime
 * @returns {string|null}
 */
function normalizeExifTimestamp(exifDateTime) {
  if (!exifDateTime) return null;
  // EXIF format: "2024:03:27 16:33:53" → "2024-03-27T16:33:53"
  const iso = exifDateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Extract GPS coordinates and all EXIF metadata from a photo.
 *
 * @param {string} imageUri – Web-accessible URI of the captured photo
 * @returns {Promise<{latitude: number|null, longitude: number|null, altitude: number|null, capturedAt: string|null, allTags: Object}>}
 */
export async function extractExifGeodata(imageUri) {
  const result = { latitude: null, longitude: null, altitude: null, capturedAt: null, allTags: {} };

  try {
    const response = await fetch(imageUri);
    const buffer = await response.arrayBuffer();
    const tags = ExifReader.load(buffer, { expanded: true });

    if (tags.gps) {
      if (tags.gps.Latitude != null) result.latitude = tags.gps.Latitude;
      if (tags.gps.Longitude != null) result.longitude = tags.gps.Longitude;
      if (tags.gps.Altitude != null) result.altitude = tags.gps.Altitude;
    }

    if (tags.exif && tags.exif.DateTimeOriginal) {
      result.capturedAt = normalizeExifTimestamp(tags.exif.DateTimeOriginal.description);
    }

    // Collect all readable EXIF tags for display
    result.allTags = flattenExifTags(tags);
  } catch (err) {
    console.warn('EXIF extraction failed:', err);
  }

  return result;
}

/**
 * Flatten ExifReader expanded-format tags into a simple { label: value } map.
 * Skips binary blobs, thumbnails, and redundant internal fields.
 *
 * @param {Object} tags – ExifReader expanded output
 * @returns {Object} flat map of human-readable tag names to string values
 */
function flattenExifTags(tags) {
  const flat = {};
  const MAX_DISPLAY_LENGTH = 200;
  const skipGroups = new Set(['Thumbnail', 'mpentry', 'icc']);
  const skipKeys = new Set([
    'MakerNote', 'UserComment', 'ComponentsConfiguration',
    'FileSource', 'SceneType', 'undefined',
  ]);

  for (const [group, entries] of Object.entries(tags)) {
    if (skipGroups.has(group)) continue;
    if (!entries || typeof entries !== 'object') continue;

    for (const [key, tag] of Object.entries(entries)) {
      if (skipKeys.has(key)) continue;
      if (tag == null) continue;

      // expanded gps values are raw numbers, use them directly
      if (group === 'gps') {
        flat[key] = String(tag);
        continue;
      }

      const desc = tag.description != null ? String(tag.description) : null;
      const val = tag.value != null ? String(tag.value) : null;
      const display = desc || val;

      // Skip empty, very long (binary), or purely numeric ID values
      if (!display || display.length > MAX_DISPLAY_LENGTH) continue;

      flat[key] = display;
    }
  }

  return flat;
}

/**
 * Ensure the app has geolocation permissions, requesting them if needed.
 * Returns true when permission is granted, false otherwise.
 *
 * @returns {Promise<boolean>}
 */
async function ensureGeolocationPermission() {
  let status = await Geolocation.checkPermissions();
  if (status.location === 'granted' || status.coarseLocation === 'granted') {
    return true;
  }

  if (status.location === 'denied') {
    // On some platforms 'denied' means permanently denied; requesting again won't help
    return false;
  }

  // status is 'prompt' or 'prompt-with-rationale' — request permission
  status = await Geolocation.requestPermissions({ permissions: ['location'] });
  return status.location === 'granted' || status.coarseLocation === 'granted';
}

/**
 * Get the device's current GPS position via Capacitor Geolocation.
 *
 * @returns {Promise<{latitude: number|null, longitude: number|null, altitude: number|null, accuracy: number|null, capturedAt: string|null}>}
 */
export async function getDevicePosition() {
  const result = { latitude: null, longitude: null, altitude: null, accuracy: null, capturedAt: null };

  try {
    const granted = await ensureGeolocationPermission();
    if (!granted) {
      console.warn('Geolocation permission not granted');
      return result;
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    result.latitude = position.coords.latitude;
    result.longitude = position.coords.longitude;
    result.altitude = position.coords.altitude;
    result.accuracy = position.coords.accuracy;
    result.capturedAt = new Date(position.timestamp).toISOString();
  } catch (err) {
    console.warn('Device geolocation failed:', err);
  }

  return result;
}

/**
 * Collect geotag metadata for a captured photo.
 *
 * Attempts to read GPS from the photo's EXIF data first, then falls back
 * to the device's live GPS position. Returns a flat object suitable for
 * future SQLite storage (field names match the photos table schema).
 * Also includes allTags – every readable EXIF tag from the photo.
 *
 * @param {string} imageUri – Web-accessible URI of the captured photo
 * @returns {Promise<{latitude: number|null, longitude: number|null, altitude: number|null, accuracy: number|null, capturedAt: string, source: 'exif'|'device'|'none', allTags: Object}>}
 */
export async function collectGeotagData(imageUri) {
  // Run both in parallel: GPS acquisition can take several seconds, so
  // starting it while EXIF is being parsed gives better perceived latency.
  const [exif, device] = await Promise.all([
    extractExifGeodata(imageUri),
    getDevicePosition(),
  ]);

  const now = new Date().toISOString();
  const allTags = exif.allTags || {};

  // Prefer EXIF GPS (from the actual photo), fall back to device GPS
  if (exif.latitude != null && exif.longitude != null) {
    return {
      latitude: exif.latitude,
      longitude: exif.longitude,
      altitude: exif.altitude,
      accuracy: null,
      capturedAt: exif.capturedAt || device.capturedAt || now,
      source: 'exif',
      allTags,
    };
  }

  if (device.latitude != null && device.longitude != null) {
    return {
      latitude: device.latitude,
      longitude: device.longitude,
      altitude: device.altitude,
      accuracy: device.accuracy,
      capturedAt: device.capturedAt || now,
      source: 'device',
      allTags,
    };
  }

  return {
    latitude: null,
    longitude: null,
    altitude: null,
    accuracy: null,
    capturedAt: now,
    source: 'none',
    allTags,
  };
}
