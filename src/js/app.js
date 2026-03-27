import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { initI18n, t } from './i18n.js';
import { collectGeotagData } from './geotag.js';

async function init() {
  initI18n();

  const platform = Capacitor.getPlatform();
  console.log(`Running on platform: ${platform}`);

  // --- Camera ---
  const takePhotoBtn = document.getElementById('take-photo-btn');
  const photoImage = document.getElementById('photo-image');
  const metadataContainer = document.getElementById('photo-metadata');

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

      // Extract geotag metadata from the photo
      if (metadataContainer && imageSrc) {
        metadataContainer.hidden = false;
        metadataContainer.textContent = t('metadata.loading');

        const geotag = await collectGeotagData(imageSrc);
        console.log('Geotag metadata:', geotag);
        renderMetadata(metadataContainer, geotag);
      }
    } catch (err) {
      console.log('Photo cancelled or failed:', err);
    }
  });
}

/**
 * Render geotag metadata into the given container element.
 */
function renderMetadata(container, geotag) {
  if (geotag.latitude != null && geotag.longitude != null) {
    const lines = [
      `${t('metadata.latitude')}: ${geotag.latitude.toFixed(6)}`,
      `${t('metadata.longitude')}: ${geotag.longitude.toFixed(6)}`,
    ];
    if (geotag.altitude != null) {
      lines.push(`${t('metadata.altitude')}: ${geotag.altitude.toFixed(1)} m`);
    }
    if (geotag.accuracy != null) {
      lines.push(`${t('metadata.accuracy')}: ±${geotag.accuracy.toFixed(0)} m`);
    }
    lines.push(`${t('metadata.capturedAt')}: ${geotag.capturedAt}`);
    lines.push(`${t('metadata.source')}: ${t('metadata.source.' + geotag.source)}`);
    container.textContent = lines.join('\n');
  } else {
    container.textContent = t('metadata.unavailable');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
