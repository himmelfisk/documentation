import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { initI18n } from './i18n.js';
import { initAuth, login, logout, getAccount } from './auth.js';

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function showLogin() {
  document.getElementById('login-screen').hidden = false;
  document.getElementById('app').hidden = true;
}

function showApp(account) {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app').hidden = false;

  const userName = document.getElementById('user-name');
  if (userName && account) {
    userName.textContent = account.name || account.username || '';
  }
}

function showLoginError(err) {
  const el = document.getElementById('login-error');
  if (!el) return;

  const message =
    (err && typeof err.message === 'string' && err.message) ||
    (typeof err === 'string' && err) ||
    'Authentication failed. Please try again.';
  el.textContent = message;
  el.hidden = false;
}

// ---------------------------------------------------------------------------
// Main init
// ---------------------------------------------------------------------------

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

  if (takePhotoBtn) {
    takePhotoBtn.addEventListener('click', async () => {
      try {
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
      } catch (err) {
        console.log('Photo cancelled or failed:', err);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
