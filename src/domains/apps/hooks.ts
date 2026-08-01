import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb } from '../../store/db';
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
