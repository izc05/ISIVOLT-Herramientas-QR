import PocketBase from 'pocketbase';
import { getCentralSyncConfig } from './config';

let client: PocketBase | null = null;
let fingerprint = '';

export const getCentralSyncClient = (): PocketBase | null => {
  const config = getCentralSyncConfig();
  if (!config.enabled || !config.serverUrl) return null;

  if (client && fingerprint === config.serverUrl) return client;

  fingerprint = config.serverUrl;
  client = new PocketBase(config.serverUrl);
  client.autoCancellation(false);
  return client;
};

export const resetCentralSyncClientForTests = () => {
  client?.authStore.clear();
  client = null;
  fingerprint = '';
};
