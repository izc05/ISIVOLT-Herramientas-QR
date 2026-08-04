import { useEffect } from 'react';
import { activeStorageKey, announceActiveData } from '../storage';

export default function WorkspaceStorageBridge() {
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key !== null && event.key !== activeStorageKey()) return;
      announceActiveData();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
}
