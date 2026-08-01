export type AuthType = 'api_key' | 'oauth';

export interface AppWithStatus {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  auth_type: AuthType;
  is_enabled: boolean;
  is_ai: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string | null;
}

export interface VerifyResult {
  ok: boolean;
  note?: string;
}

export interface ModelInfo {
  raw_name: string;
  display_name: string;
}
