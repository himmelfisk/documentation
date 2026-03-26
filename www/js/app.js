import { Capacitor } from '@capacitor/core';

document.addEventListener('DOMContentLoaded', () => {
  const platform = Capacitor.getPlatform();
  console.log(`Running on platform: ${platform}`);
});
