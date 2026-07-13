import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.isivolt.herramientasqr.rc9',
  appName: 'ISIVOLT Herramientas QR RC9',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false,
        biometricTitle: 'Acceso a ISIVOLT Herramientas QR',
        biometricSubTitle: 'Protección de la base de datos local',
      },
    },
  },
};

export default config;
