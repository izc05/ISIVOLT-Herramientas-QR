import PocketBase from 'pocketbase';
import { getCentralSyncConfig } from './config';

export const ISIVOLT_AUTH_COLLECTION = 'isivolt_users';

let client: PocketBase | null = null;
let fingerprint = '';

const createIsivoltClient = (serverUrl: string): PocketBase => {
  const pocketBase = new PocketBase(serverUrl);
  pocketBase.autoCancellation(false);

  // Compatibilidad temporal con componentes RC37 que usaban el nombre genérico
  // `users`. Toda autenticación termina siempre en la colección aislada ISIVOLT.
  const collection = pocketBase.collection.bind(pocketBase);
  pocketBase.collection = ((name: string) =>
    collection(name === 'users' ? ISIVOLT_AUTH_COLLECTION : name)) as typeof pocketBase.collection;

  return pocketBase;
};

export const getCentralSyncClient = (): PocketBase | null => {
  const config = getCentralSyncConfig();
  if (!config.enabled || !config.serverUrl) return null;

  if (client && fingerprint === config.serverUrl) return client;

  fingerprint = config.serverUrl;
  client = createIsivoltClient(config.serverUrl);
  return client;
};

export const resetCentralSyncClientForTests = () => {
  client?.authStore.clear();
  client = null;
  fingerprint = '';
};
