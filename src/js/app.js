import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { initI18n } from './i18n.js';

async function init() {
  initI18n();

  const platform = Capacitor.getPlatform();
  console.log(`Running on platform: ${platform}`);

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
