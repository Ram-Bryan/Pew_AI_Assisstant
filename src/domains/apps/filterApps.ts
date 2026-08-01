import type { AppWithStatus } from './types';

export interface AppFilters {
  enabled: 'all' | 'enabled' | 'disabled';
  kind: 'all' | 'ai' | 'app';
}

export function filterApps(
  list: AppWithStatus[],
  query: string,
  filters: AppFilters
): AppWithStatus[] {
  const q = query.trim().toLowerCase();
  return list.filter((app) => {
    if (filters.kind === 'ai' && !app.is_ai) return false;
    if (filters.kind === 'app' && app.is_ai) return false;
    if (filters.enabled === 'enabled' && !app.is_enabled) return false;
    if (filters.enabled === 'disabled' && app.is_enabled) return false;
    if (q && !`${app.name} ${app.description ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
