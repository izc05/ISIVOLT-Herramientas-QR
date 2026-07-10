import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.isivolt.herramientasqr',
  appName: 'ISIVOLT Herramientas QR',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
