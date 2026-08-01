import { getCentralSyncClient } from '../services/centralSync/client';
import { getCurrentSecurityUser } from './session';

export type EffectiveTechnicianIdentity = {
  technicianId: string;
  source: 'pocketbase' | 'local';
  name?: string;
  email?: string;
};

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export const getEffectiveTechnicianIdentity = (): EffectiveTechnicianIdentity | null => {
  const remote = getCentralSyncClient()?.authStore.record;
  const remoteRole = text(remote?.role);
  const remoteTechnicianId = text(remote?.technician_id);
  if (remoteRole === 'technician' && remoteTechnicianId) {
    return {
      technicianId: remoteTechnicianId,
      source: 'pocketbase',
      name: text(remote?.name) || undefined,
      email: text(remote?.email) || undefined,
    };
  }

  const local = getCurrentSecurityUser();
  if (local?.active && local.role === 'technician' && local.technicianId) {
    return {
      technicianId: local.technicianId,
      source: 'local',
      name: local.name,
    };
  }

  return null;
};

export const getEffectiveTechnicianId = () => getEffectiveTechnicianIdentity()?.technicianId ?? null;
