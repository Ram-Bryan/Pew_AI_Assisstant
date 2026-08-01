import { api } from '../../services/api';
import type { TokenPair, VerifyResult } from './types';

export function verifyCredential(idApp: number, apiKey: string): Promise<VerifyResult> {
  return api.post<VerifyResult>('/api/apps/verify', { id_app: idApp, api_key: apiKey });
}

export function exchangeOAuth(idApp: number, code: string): Promise<TokenPair> {
  return api.post<TokenPair>('/api/apps/oauth/exchange', { id_app: idApp, code });
}
