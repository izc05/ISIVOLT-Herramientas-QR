import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getCentralSyncConfig } from './config';

let client: SupabaseClient | null = null;
let fingerprint = '';

export const getCentralSyncClient = (): SupabaseClient | null => {
  const config = getCentralSyncConfig();
  if (!config.enabled || !config.supabaseUrl || !config.publishableKey) return null;

  const nextFingerprint = `${config.supabaseUrl}|${config.publishableKey}`;
  if (client && fingerprint === nextFingerprint) return client;

  fingerprint = nextFingerprint;
  client = createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
};

export const resetCentralSyncClientForTests = () => {
  client = null;
  fingerprint = '';
};
