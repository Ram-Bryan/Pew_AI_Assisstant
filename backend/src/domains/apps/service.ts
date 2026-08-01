import { verifyApiKey } from '../providers/clients';
import type { VerifyRequest, VerifyResult } from './types';

export async function verifyCredential(req: VerifyRequest): Promise<VerifyResult> {
  return verifyApiKey(req.id_app, req.api_key);
}
