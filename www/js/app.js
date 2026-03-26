import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

document.addEventListener('DOMContentLoaded', () => {
  const platform = Capacitor.getPlatform();
  console.log(`Running on platform: ${platform}`);

  const takePhotoBtn = document.getElementById('take-photo-btn');
  const photoImage = document.getElementById('photo-image');

  takePhotoBtn.addEventListener('click', async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        quality: 90,
      });

      photoImage.src = photo.webPath;
      photoImage.hidden = false;
    } catch (err) {
      console.log('Photo cancelled or failed:', err);
    }
  });
});
