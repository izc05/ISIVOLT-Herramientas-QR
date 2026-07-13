import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.isivolt.herramientasqr.rc10',
  appName: 'ISIVOLT Herramientas QR RC10',
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
