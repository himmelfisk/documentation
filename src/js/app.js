import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { initAuth, login, logout, getAccessTokenSilent } from './auth.js';
import { initI18n, t } from './i18n.js';
import { collectGeotagData, ensureGeolocationPermission } from './geotag.js';

async function init() {
  initI18n();

  const platform = Capacitor.getPlatform();
  console.log(`Running on platform: ${platform}`);

  // ---- Authentication ----
  try {
    const account = await initAuth();

    if (account) {
      console.log('Authenticated:', account.name || account.username);
      showApp(account);
    } else {
      showLogin();
    }
  } catch (err) {
    console.error('Auth initialisation failed:', err);
    showLogin();
    showLoginError(err);
  }

  // ---- Login button ----
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      try {
        loginBtn.disabled = true;
        await login();
        // The page navigates away for the redirect flow — this line is
        // only reached if something prevents the redirect.
      } catch (err) {
        console.error('Login failed:', err);
        showLoginError(err);
        loginBtn.disabled = false;
      }
    });
  }

  // ---- Logout button ----
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await logout();
      } catch (err) {
        console.error('Logout failed:', err);
      }
    });
  }

  // ---- Camera ----
  const takePhotoBtn = document.getElementById('take-photo-btn');
  const photoImage = document.getElementById('photo-image');
  const metadataContainer = document.getElementById('photo-metadata');

  if (takePhotoBtn) {
    takePhotoBtn.addEventListener('click', async () => {
      try {
        // Request location permission before opening the camera so that:
        // 1. On iOS, the camera can embed GPS in the photo's EXIF metadata
        // 2. Device GPS fallback is ready immediately after capture
        await ensureGeolocationPermission();

        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt,
          quality: 90,
        });

        const imageSrc = photo.webPath || photo.path;
        if (imageSrc && photoImage) {
          photoImage.src = imageSrc;
          photoImage.hidden = false;
        }

        // Extract geotag metadata from the photo
        if (metadataContainer && imageSrc) {
          metadataContainer.hidden = false;
          metadataContainer.textContent = t('metadata.loading');

          try {
            const geotag = await collectGeotagData(imageSrc, photo.exif);
            console.log('Geotag metadata:', geotag);
            renderMetadata(metadataContainer, geotag);
          } catch (geoErr) {
            console.warn('Geotag collection failed:', geoErr);
            metadataContainer.textContent = t('metadata.unavailable');
          }
        }
      } catch (err) {
        console.log('Photo cancelled or failed:', err);
      }
    });
  }
}

/**
 * Fetch the organisation display name from Microsoft Graph.
 * Requires the Organisation.Read.All delegated permission to have been
 * granted (admin-consent) on the app registration.  Returns null when
 * the permission is missing or the call fails for any other reason.
 */
async function fetchOrganizationName() {
  try {
    const token = await getAccessTokenSilent(['Organization.Read.All']);
    if (!token) return null;
    const res = await fetch('https://graph.microsoft.com/v1.0/organization', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.value?.[0]?.displayName ?? null;
  } catch {
    return null;
  }
}

/**
 * Show the main app UI and populate user info.
 */
function showApp(account) {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  if (loginScreen) loginScreen.hidden = true;
  if (app) app.hidden = false;
  const userName = document.getElementById('user-name');
  const greetingName = document.getElementById('greeting-name');
  if (userName) userName.textContent = account.name || account.username;
  if (greetingName) greetingName.textContent = account.name || account.username;

  const tenantIdEl = document.getElementById('tenant-id');
  if (tenantIdEl) tenantIdEl.textContent = account.tenantId;

  const companyNameEl = document.getElementById('company-name');
  if (companyNameEl) {
    fetchOrganizationName().then((name) => {
      companyNameEl.textContent = name || '—';
    });
  }
}

/**
 * Show the login screen and hide the main app.
 */
function showLogin() {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  if (loginScreen) loginScreen.hidden = false;
  if (app) app.hidden = true;
}

/**
 * Display a login error message to the user.
 */
function showLoginError(err) {
  const el = document.getElementById('login-error');
  if (el) {
    el.textContent = err.message || String(err);
    el.hidden = false;
  }
}

/**
 * Render geotag metadata and all EXIF data into the given container element.
 */
function renderMetadata(container, geotag) {
  const mapLink = document.getElementById('photo-map-link');

  const lines = [];

  // --- GPS / location section ---
  const lat = Number(geotag.latitude);
  const lng = Number(geotag.longitude);

  if (geotag.latitude != null && geotag.longitude != null && isFinite(lat) && isFinite(lng)) {
    lines.push(`${t('metadata.latitude')}: ${lat.toFixed(6)}`);
    lines.push(`${t('metadata.longitude')}: ${lng.toFixed(6)}`);
    if (geotag.altitude != null) {
      const alt = Number(geotag.altitude);
      if (isFinite(alt)) lines.push(`${t('metadata.altitude')}: ${alt.toFixed(1)} m`);
    }
    if (geotag.accuracy != null) {
      const acc = Number(geotag.accuracy);
      if (isFinite(acc)) lines.push(`${t('metadata.accuracy')}: ±${acc.toFixed(0)} m`);
    }
    if (geotag.capturedAt) {
      const capturedDate = new Date(geotag.capturedAt);
      if (!isNaN(capturedDate.getTime())) {
        lines.push(`${t('metadata.capturedAt')}: ${capturedDate.toLocaleString()}`);
      }
    }
    lines.push(`${t('metadata.source')}: ${t('metadata.source.' + geotag.source)}`);

    if (mapLink) {
      mapLink.href = `https://www.google.com/maps?q=${lat},${lng}`;
      mapLink.textContent = t('metadata.openMap');
      mapLink.hidden = false;
    }
  } else {
    lines.push(t('metadata.unavailable'));
    if (mapLink) mapLink.hidden = true;
  }

  // --- All EXIF tags ---
  if (geotag.allTags && Object.keys(geotag.allTags).length > 0) {
    lines.push('');
    lines.push(`── ${t('metadata.exifHeader')} ──`);
    for (const [key, value] of Object.entries(geotag.allTags)) {
      lines.push(`${key}: ${value}`);
    }
  }

  container.textContent = lines.join('\n');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
