import OpenAI from 'openai';
import { HttpError } from '../../shared/middleware/error';
import type { ModelInfo } from './types';

type ProviderKind = 'openai_compatible' | 'anthropic' | 'gemini' | 'cohere';

interface ProviderConfig {
  kind: ProviderKind;
  baseUrl: string;
}

const PROVIDER_CONFIGS: Record<number, ProviderConfig> = {
  1: { kind: 'openai_compatible', baseUrl: 'https://api.openai.com/v1' },
  2: { kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  3: { kind: 'openai_compatible', baseUrl: 'https://api.deepseek.com/v1' },
  7: { kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  8: { kind: 'openai_compatible', baseUrl: 'https://api.groq.com/openai/v1' },
  9: { kind: 'openai_compatible', baseUrl: 'https://api.mistral.ai/v1' },
  10: { kind: 'openai_compatible', baseUrl: 'https://openrouter.ai/api/v1' },
  11: { kind: 'cohere', baseUrl: 'https://api.cohere.com/v1' },
};

const OAUTH_APP_IDS = new Set([4, 5, 6]);

async function listOpenAiCompatible(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  const client = new OpenAI({ apiKey, baseURL: baseUrl });
  const page = await client.models.list();
  return page.data.map((m) => ({ raw_name: m.id, display_name: m.id }));
}

async function listAnthropic(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const body = (await res.json()) as { data: Array<{ id: string; display_name?: string }> };
  return body.data.map((m) => ({ raw_name: m.id, display_name: m.display_name ?? m.id }));
}

async function listGemini(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const body = (await res.json()) as { models: Array<{ name: string; displayName?: string }> };
  return body.models.map((m) => {
    const raw = m.name.replace(/^models\//, '');
    return { raw_name: raw, display_name: m.displayName ?? raw };
  });
}

async function listCohere(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.cohere.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`cohere ${res.status}`);
  const body = (await res.json()) as { models: Array<{ name: string; display_name?: string }> };
  return body.models.map((m) => ({ raw_name: m.name, display_name: m.display_name ?? m.name }));
}

export async function listModelsForProvider(idApp: number, apiKey: string): Promise<ModelInfo[]> {
  const config = PROVIDER_CONFIGS[idApp];
  if (!config) throw new HttpError(404, 'unknown_app');
  switch (config.kind) {
    case 'openai_compatible':
      return listOpenAiCompatible(config.baseUrl, apiKey);
    case 'anthropic':
      return listAnthropic(apiKey);
    case 'gemini':
      return listGemini(apiKey);
    case 'cohere':
      return listCohere(apiKey);
  }
}

export async function verifyApiKey(idApp: number, apiKey: string): Promise<{ ok: boolean; note?: string }> {
  if (OAUTH_APP_IDS.has(idApp)) {
    return { ok: true, note: 'oauth_verification_not_available' };
  }
  if (!(idApp in PROVIDER_CONFIGS)) {
    throw new HttpError(404, 'unknown_app');
  }
  try {
    await listModelsForProvider(idApp, apiKey);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
