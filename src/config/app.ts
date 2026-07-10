export const APP_NAME = 'ISIVOLT Herramientas QR';
export const APP_VERSION = '1.0.0-rc.2';
export const APP_SCHEMA_VERSION = 1 as const;
export const DATABASE_SCHEMA_VERSION = 3 as const;
export const BACKUP_FORMAT = 'ISIVOLT-HERRAMIENTAS-BACKUP' as const;

export const buildAppLabel = () => `${APP_NAME} v${APP_VERSION}`;
