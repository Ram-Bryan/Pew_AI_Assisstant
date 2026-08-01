import { HttpError } from '../../shared/middleware/error';
import { verifyApiKey } from '../providers/clients';
import type { OAuthExchangeRequest, TokenPair, VerifyRequest, VerifyResult } from './types';

const OAUTH_APP_IDS = new Set([4, 5, 6]);

export async function verifyCredential(req: VerifyRequest): Promise<VerifyResult> {
  return verifyApiKey(req.id_app, req.api_key);
}

export async function exchangeOAuth(req: OAuthExchangeRequest): Promise<TokenPair> {
  if (!OAUTH_APP_IDS.has(req.id_app)) {
    throw new HttpError(404, 'unknown_app');
  }
  return {
    access_token: `stub_access_${req.id_app}_${req.code}`,
    refresh_token: `stub_refresh_${req.id_app}_${req.code}`,
  };
}
