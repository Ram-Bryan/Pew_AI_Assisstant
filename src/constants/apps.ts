export interface SeedApp {
  id: number;
  name: string;
  description: string;
  icon: string;
  auth_type: 'api_key' | 'oauth';
  helpUrl: string;
}

export interface SeedProvider {
  id: number;
  id_app: number;
  api_base_url: string;
  supports_tool_calling: boolean;
}

export interface SeedSetting {
  key: string;
  label: string;
  description: string;
  value: string;
}

export const SEED_APPS: SeedApp[] = [
  { id: 1, name: 'OpenAI', description: 'GPT models', icon: 'openai', auth_type: 'api_key', helpUrl: 'https://platform.openai.com/api-keys' },
  { id: 2, name: 'Anthropic', description: 'Claude models', icon: 'anthropic', auth_type: 'api_key', helpUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 3, name: 'DeepSeek', description: 'DeepSeek models', icon: 'deepseek', auth_type: 'api_key', helpUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 4, name: 'Gmail', description: 'Send and read email', icon: 'gmail', auth_type: 'oauth', helpUrl: 'https://developers.google.com/gmail/api/auth' },
  { id: 5, name: 'Messenger', description: 'Send messages', icon: 'messenger', auth_type: 'oauth', helpUrl: 'https://developers.facebook.com/docs/messenger-platform' },
  { id: 6, name: 'WhatsApp', description: 'Send messages', icon: 'whatsapp', auth_type: 'oauth', helpUrl: 'https://developers.facebook.com/docs/whatsapp' },
  { id: 7, name: 'Google Gemini', description: 'Gemini models, free tier available', icon: 'gemini', auth_type: 'api_key', helpUrl: 'https://aistudio.google.com/apikey' },
  { id: 8, name: 'Groq', description: 'Fast inference, generous free tier', icon: 'groq', auth_type: 'api_key', helpUrl: 'https://console.groq.com/keys' },
  { id: 9, name: 'Mistral AI', description: 'Mistral models, free tier available', icon: 'mistral', auth_type: 'api_key', helpUrl: 'https://console.mistral.ai/api-keys' },
  { id: 10, name: 'OpenRouter', description: 'Aggregates many free + paid models', icon: 'openrouter', auth_type: 'api_key', helpUrl: 'https://openrouter.ai/keys' },
  { id: 11, name: 'Cohere', description: 'Command models, free trial key', icon: 'cohere', auth_type: 'api_key', helpUrl: 'https://dashboard.cohere.com/api-keys' },
];

export const SEED_PROVIDERS: SeedProvider[] = [
  { id: 1, id_app: 1, api_base_url: 'https://api.openai.com/v1', supports_tool_calling: true },
  { id: 2, id_app: 2, api_base_url: 'https://api.anthropic.com/v1', supports_tool_calling: true },
  { id: 3, id_app: 3, api_base_url: 'https://api.deepseek.com/v1', supports_tool_calling: true },
  { id: 4, id_app: 7, api_base_url: 'https://generativelanguage.googleapis.com/v1beta', supports_tool_calling: true },
  { id: 5, id_app: 8, api_base_url: 'https://api.groq.com/openai/v1', supports_tool_calling: true },
  { id: 6, id_app: 9, api_base_url: 'https://api.mistral.ai/v1', supports_tool_calling: true },
  { id: 7, id_app: 10, api_base_url: 'https://openrouter.ai/api/v1', supports_tool_calling: true },
  { id: 8, id_app: 11, api_base_url: 'https://api.cohere.com/v1', supports_tool_calling: true },
];

export const STATUS_SEED = {
  chat: [
    { id: 1, label: 'active' },
    { id: 2, label: 'archived' },
    { id: 3, label: 'deleted' },
  ],
  message: [
    { id: 1, label: 'active' },
    { id: 2, label: 'deleted' },
  ],
  tool_call: [
    { id: 1, label: 'pending' },
    { id: 2, label: 'approved' },
    { id: 3, label: 'rejected' },
    { id: 4, label: 'completed' },
    { id: 5, label: 'failed' },
  ],
};

export const SETTINGS_SEED: SeedSetting[] = [
  { key: 'require_confirmation', label: 'Require confirmation before actions', description: 'Ask for approval before the AI performs any action in a connected app.', value: 'true' },
  { key: 'max_tool_calls_per_turn', label: 'Max chained actions per message', description: 'Upper limit on how many tool calls the AI can chain in a single turn.', value: '5' },
  { key: 'max_requests_per_day', label: 'Daily request limit', description: 'Upper limit on chat requests per day, used as a budget guardrail.', value: '200' },
  { key: 'voice_output_enabled', label: 'Read replies aloud', description: 'Whether the assistant speaks its replies using on-device text-to-speech.', value: 'true' },
];
