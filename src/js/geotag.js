import ExifReader from 'exifreader';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Extract GPS coordinates and metadata from a photo's EXIF data.
 *
 * @param {string} imageUri – Web-accessible URI of the captured photo
 * @returns {Promise<{latitude: number|null, longitude: number|null, altitude: number|null, timestamp: string|null}>}
 */
export async function extractExifGeodata(imageUri) {
  const result = { latitude: null, longitude: null, altitude: null, timestamp: null };

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
      result.timestamp = tags.exif.DateTimeOriginal.description;
    }
  } catch (err) {
    console.warn('EXIF extraction failed:', err);
  }

  return result;
}

/**
 * Get the device's current GPS position via Capacitor Geolocation.
 *
 * @returns {Promise<{latitude: number|null, longitude: number|null, altitude: number|null, accuracy: number|null, timestamp: string|null}>}
 */
export async function getDevicePosition() {
  const result = { latitude: null, longitude: null, altitude: null, accuracy: null, timestamp: null };

  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    result.latitude = position.coords.latitude;
    result.longitude = position.coords.longitude;
    result.altitude = position.coords.altitude;
    result.accuracy = position.coords.accuracy;
    result.timestamp = new Date(position.timestamp).toISOString();
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
 * future SQLite storage.
 *
 * @param {string} imageUri – Web-accessible URI of the captured photo
 * @returns {Promise<{latitude: number|null, longitude: number|null, altitude: number|null, accuracy: number|null, timestamp: string, source: 'exif'|'device'|'none'}>}
 */
export async function collectGeotagData(imageUri) {
  // Run both in parallel: GPS acquisition can take several seconds, so
  // starting it while EXIF is being parsed gives better perceived latency.
  const [exif, device] = await Promise.all([
    extractExifGeodata(imageUri),
    getDevicePosition(),
  ]);

  const capturedAt = new Date().toISOString();

  // Prefer EXIF GPS (from the actual photo), fall back to device GPS
  if (exif.latitude != null && exif.longitude != null) {
    return {
      latitude: exif.latitude,
      longitude: exif.longitude,
      altitude: exif.altitude,
      accuracy: null,
      timestamp: exif.timestamp || device.timestamp || capturedAt,
      source: 'exif',
    };
  }

  if (device.latitude != null && device.longitude != null) {
    return {
      latitude: device.latitude,
      longitude: device.longitude,
      altitude: device.altitude,
      accuracy: device.accuracy,
      timestamp: device.timestamp || capturedAt,
      source: 'device',
    };
  }

  return {
    latitude: null,
    longitude: null,
    altitude: null,
    accuracy: null,
    timestamp: capturedAt,
    source: 'none',
  };
}
