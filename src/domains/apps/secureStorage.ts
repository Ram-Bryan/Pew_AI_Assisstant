import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from './types';

function keyName(appId: number, kind: 'apikey' | 'oauth') {
  return `${kind}_${appId}`;
}

export async function saveApiKey(appId: number, apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(keyName(appId, 'apikey'), apiKey);
}

export async function getApiKey(appId: number): Promise<string | null> {
  return SecureStore.getItemAsync(keyName(appId, 'apikey'));
}

export async function deleteApiKey(appId: number): Promise<void> {
  await SecureStore.deleteItemAsync(keyName(appId, 'apikey'));
}

export async function saveTokenPair(appId: number, tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(keyName(appId, 'oauth'), JSON.stringify(tokens));
}

export async function getTokenPair(appId: number): Promise<TokenPair | null> {
  const raw = await SecureStore.getItemAsync(keyName(appId, 'oauth'));
  return raw ? (JSON.parse(raw) as TokenPair) : null;
}

export async function deleteTokenPair(appId: number): Promise<void> {
  await SecureStore.deleteItemAsync(keyName(appId, 'oauth'));
}
