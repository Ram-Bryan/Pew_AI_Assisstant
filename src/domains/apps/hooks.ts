import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb } from '../../store/db';
import { verifyCredential } from './api';
import * as secureStorage from './secureStorage';
import { listApps, setAppEnabled } from './store';

export function useAppsList() {
  return useQuery({
    queryKey: ['apps'],
    queryFn: async () => {
      const db = await getDb();
      return listApps(db);
    },
  });
}

export function useToggleApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, enabled }: { appId: number; enabled: boolean }) => {
      const db = await getDb();
      await setAppEnabled(db, appId, enabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}

export function useConnectApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, apiKey }: { appId: number; apiKey: string }) => {
      const result = await verifyCredential(appId, apiKey);
      if (!result.ok) {
        throw new Error('invalid_credentials');
      }
      await secureStorage.saveApiKey(appId, apiKey);
      const db = await getDb();
      await setAppEnabled(db, appId, true);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}
