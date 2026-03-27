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
 * Parse a rational EXIF GPS coordinate string ("deg/1,min/1,sec/100") with a
 * reference direction ("N"/"S"/"E"/"W") into a signed decimal number.
 *
 * @param {string} coord – e.g. "59/1,54/1,4136/100"
 * @param {string} ref   – e.g. "N" or "W"
 * @returns {number|null}
 */
function parseExifGpsRational(coord, ref) {
  if (typeof coord !== 'string' || !coord) return null;
  const parts = coord.split(',').map(p => {
    const [num, den] = p.trim().split('/').map(Number);
    return den ? num / den : NaN;
  });
  if (parts.length < 3 || parts.some(n => isNaN(n))) return null;
  let decimal = parts[0] + parts[1] / 60 + parts[2] / 3600;
  if (ref === 'S' || ref === 'W') decimal = -decimal;
  return decimal;
}

/**
 * Parse a rational EXIF altitude string ("123/10") into a number.
 *
 * @param {string} alt    – e.g. "123/10"
 * @param {string} [ref]  – "0" (above sea) or "1" (below sea)
 * @returns {number|null}
 */
function parseExifAltitudeRational(alt, ref) {
  if (typeof alt !== 'string' || !alt) return null;
  const [num, den] = alt.split('/').map(Number);
  if (!den || isNaN(num)) return null;
  let value = num / den;
  if (ref === '1') value = -value;
  return value;
}

/**
 * Extract GPS coordinates and capture timestamp from the Camera plugin's
 * native `photo.exif` object.  Handles both Android (flat, rational strings)
 * and iOS (nested GPS dict with decimal values) formats.
 *
 * @param {Object} cameraExif – photo.exif from @capacitor/camera
 * @returns {{latitude: number|null, longitude: number|null, altitude: number|null, capturedAt: string|null}}
 */
function parseGpsFromCameraExif(cameraExif) {
  const result = { latitude: null, longitude: null, altitude: null, capturedAt: null };
  if (!cameraExif || typeof cameraExif !== 'object') return result;

  // iOS returns GPS data under a "{GPS}" key (mapped to "GPS" in JSON).
  // Check lowercase too in case a future platform variant uses it.
  const gps = cameraExif.GPS || cameraExif.gps;
  if (gps && typeof gps === 'object') {
    if (gps.Latitude != null && gps.Longitude != null) {
      let lat = Number(gps.Latitude);
      let lng = Number(gps.Longitude);
      if (gps.LatitudeRef === 'S') lat = -Math.abs(lat);
      if (gps.LongitudeRef === 'W') lng = -Math.abs(lng);
      if (isFinite(lat) && isFinite(lng)) {
        result.latitude = lat;
        result.longitude = lng;
      }
    }
    if (gps.Altitude != null) {
      const alt = Number(gps.Altitude);
      if (isFinite(alt)) result.altitude = (gps.AltitudeRef === 1 || gps.AltitudeRef === '1') ? -alt : alt;
    }
  }

  // Android: flat rational strings (GPSLatitude, GPSLongitude, etc.)
  if (result.latitude == null && cameraExif.GPSLatitude && cameraExif.GPSLongitude) {
    const lat = parseExifGpsRational(cameraExif.GPSLatitude, cameraExif.GPSLatitudeRef);
    const lng = parseExifGpsRational(cameraExif.GPSLongitude, cameraExif.GPSLongitudeRef);
    if (lat != null && lng != null) {
      result.latitude = lat;
      result.longitude = lng;
    }
    if (cameraExif.GPSAltitude) {
      const alt = parseExifAltitudeRational(cameraExif.GPSAltitude, cameraExif.GPSAltitudeRef);
      if (alt != null) result.altitude = alt;
    }
  }

  // Timestamp (both platforms use the same EXIF tag name)
  const dto = cameraExif.DateTimeOriginal
    || (cameraExif.exif && cameraExif.exif.DateTimeOriginal);
  if (dto) {
    const description = typeof dto === 'object' ? dto.description : dto;
    result.capturedAt = normalizeExifTimestamp(String(description));
  }

  return result;
}

/**
 * Flatten the Camera plugin's native EXIF object into a {key: value} map
 * for display alongside ExifReader tags.
 *
 * @param {Object} cameraExif
 * @returns {Object}
 */
function flattenCameraExif(cameraExif) {
  const flat = {};
  if (!cameraExif || typeof cameraExif !== 'object') return flat;
  const MAX_LEN = 200;
  for (const [key, val] of Object.entries(cameraExif)) {
    if (val == null) continue;
    if (typeof val === 'object') {
      // Flatten one level (e.g. iOS GPS dict)
      for (const [subKey, subVal] of Object.entries(val)) {
        if (subVal == null) continue;
        const s = String(subVal);
        if (s.length <= MAX_LEN) flat[`${key}.${subKey}`] = s;
      }
    } else {
      const s = String(val);
      if (s.length <= MAX_LEN) flat[key] = s;
    }
  }
  return flat;
}

/**
 * Extract GPS coordinates and all EXIF metadata from a photo.
 *
 * Uses ExifReader on the image file as the primary source, then falls back to
 * the Camera plugin's native `photo.exif` data when the file has been stripped
 * of EXIF metadata during image processing.
 *
 * @param {string} imageUri – Web-accessible URI of the captured photo
 * @param {Object} [cameraExif] – photo.exif from @capacitor/camera (fallback)
 * @returns {Promise<{latitude: number|null, longitude: number|null, altitude: number|null, capturedAt: string|null, allTags: Object}>}
 */
export async function extractExifGeodata(imageUri, cameraExif) {
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

  // Fall back to Camera plugin's native EXIF when ExifReader found nothing
  // (e.g. image was re-encoded and EXIF was silently stripped).
  if (cameraExif) {
    const cam = parseGpsFromCameraExif(cameraExif);

    if (result.latitude == null && cam.latitude != null) {
      result.latitude = cam.latitude;
      result.longitude = cam.longitude;
    }
    if (result.altitude == null && cam.altitude != null) {
      result.altitude = cam.altitude;
    }
    if (!result.capturedAt && cam.capturedAt) {
      result.capturedAt = cam.capturedAt;
    }
    if (Object.keys(result.allTags).length === 0) {
      result.allTags = flattenCameraExif(cameraExif);
    }
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
export async function ensureGeolocationPermission() {
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
 * @param {Object} [cameraExif] – photo.exif from @capacitor/camera (native EXIF fallback)
 * @returns {Promise<{latitude: number|null, longitude: number|null, altitude: number|null, accuracy: number|null, capturedAt: string, source: 'exif'|'device'|'none', allTags: Object}>}
 */
export async function collectGeotagData(imageUri, cameraExif) {
  // Run both in parallel: GPS acquisition can take several seconds, so
  // starting it while EXIF is being parsed gives better perceived latency.
  const [exif, device] = await Promise.all([
    extractExifGeodata(imageUri, cameraExif),
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
