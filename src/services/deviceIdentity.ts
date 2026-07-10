import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const DEVICE_ID_KEY = 'isivolt-device-id';
let cachedDeviceId: string | null = null;

const createDeviceId = () => {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `device-${random}`;
};

export const getDeviceId = async (): Promise<string> => {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    const stored = await Preferences.get({ key: DEVICE_ID_KEY });
    if (stored.value) {
      cachedDeviceId = stored.value;
      return stored.value;
    }

    const created = createDeviceId();
    await Preferences.set({ key: DEVICE_ID_KEY, value: created });
    cachedDeviceId = created;
    return created;
  } catch {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }

    const created = createDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, created);
    cachedDeviceId = created;
    return created;
  }
};

export const getDeviceLabel = () => {
  const platform = Capacitor.getPlatform();
  return platform === 'android'
    ? 'Móvil Android de almacén'
    : platform === 'ios'
      ? 'Dispositivo iOS'
      : 'Navegador web';
};
