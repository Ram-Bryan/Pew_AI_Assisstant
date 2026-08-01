import { listModelsForProvider } from './clients';
import type { ModelInfo, ModelListRequest } from './types';

export async function listModels(req: ModelListRequest): Promise<ModelInfo[]> {
  return listModelsForProvider(req.id_app, req.api_key);
}
