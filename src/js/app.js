import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { initI18n } from './i18n.js';
import { initAuth, login, logout, getAccount } from './auth.js';
import { t } from './i18n.js';

/** Show the login screen and hide the main app. */
function showLogin() {
  document.getElementById('login-screen').hidden = false;
  document.getElementById('app').hidden = true;
}

/** Show the main app and hide the login screen. */
function showApp(account) {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app').hidden = false;

  const userNameEl = document.getElementById('user-display-name');
  if (userNameEl && account) {
    userNameEl.textContent = account.name || account.username || '';
  }
}

async function init() {
  initI18n();

  const platform = Capacitor.getPlatform();
  console.log(`Running on platform: ${platform}`);

  // --- Authentication gate ---
  const account = await initAuth();

  if (account) {
    showApp(account);
  } else {
    showLogin();
  }

  // Login button
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const loginError = document.getElementById('login-error');
      if (loginError) loginError.hidden = true;

      try {
        const acct = await login();
        showApp(acct);
      } catch (err) {
        console.error('Login failed:', err);
        if (loginError) {
          loginError.textContent = t('login.error');
          loginError.hidden = false;
        }
      }
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await logout();
      } catch (err) {
        console.error('Logout failed:', err);
      }
      showLogin();
    });
  }

  // --- Camera ---
  const takePhotoBtn = document.getElementById('take-photo-btn');
  const photoImage = document.getElementById('photo-image');

  if (!takePhotoBtn) {
    console.error('take-photo-btn not found in DOM');
    return;
  }

  takePhotoBtn.addEventListener('click', async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        quality: 90,
      });

      const imageSrc = photo.webPath || photo.path;
      if (imageSrc) {
        photoImage.src = imageSrc;
        photoImage.hidden = false;
      }
    } catch (err) {
      console.log('Photo cancelled or failed:', err);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
