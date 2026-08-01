import { api } from '../../services/api';
import type { ModelInfo } from '../apps/types';

export function discoverModels(idApp: number, apiKey: string): Promise<ModelInfo[]> {
  return api
    .post<{ models: ModelInfo[] }>('/api/providers/models', { id_app: idApp, api_key: apiKey })
    .then((r) => r.models);
}
