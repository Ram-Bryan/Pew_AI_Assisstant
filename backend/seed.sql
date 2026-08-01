-- Pew — seed.sql
-- Run once against a freshly-migrated database.
-- Populates only registry/reference data. No chat, message, tool_call,
-- attachment, or token_usage rows — those are created at runtime.
--
-- Requires providers.supports_tool_calling (see conception.md / STEPS.md
-- Sprint 3 notes) — add it to your schema before running this file:
--   ALTER TABLE providers ADD COLUMN supports_tool_calling BOOLEAN NOT NULL DEFAULT 0;

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Status reference tables
-- ---------------------------------------------------------------------
INSERT INTO status_chat (id, label) VALUES
  (1, 'active'),
  (2, 'archived'),
  (3, 'deleted');

INSERT INTO status_message (id, label) VALUES
  (1, 'active'),
  (2, 'deleted');

INSERT INTO status_tool_call (id, label) VALUES
  (1, 'pending'),
  (2, 'approved'),
  (3, 'rejected'),
  (4, 'completed'),
  (5, 'failed');

-- ---------------------------------------------------------------------
-- Apps registry — AI providers first, then integrations
-- ---------------------------------------------------------------------
INSERT INTO apps (id, name, description, icon, auth_type) VALUES
  (1,  'OpenAI',        'GPT models',                          'openai',     'api_key'),
  (2,  'Anthropic',     'Claude models',                       'anthropic',  'api_key'),
  (3,  'DeepSeek',      'DeepSeek models',                     'deepseek',   'api_key'),
  (4,  'Gmail',         'Send and read email',                 'gmail',      'oauth'),
  (5,  'Messenger',     'Send messages',                       'messenger',  'oauth'),
  (6,  'WhatsApp',      'Send messages',                       'whatsapp',   'oauth'),
  (7,  'Google Gemini', 'Gemini models, free tier available',  'gemini',     'api_key'),
  (8,  'Groq',          'Fast inference, generous free tier',  'groq',       'api_key'),
  (9,  'Mistral AI',    'Mistral models, free tier available', 'mistral',    'api_key'),
  (10, 'OpenRouter',    'Aggregates many free + paid models',  'openrouter', 'api_key'),
  (11, 'Cohere',        'Command models, free trial key',      'cohere',     'api_key');

-- ---------------------------------------------------------------------
-- Providers — subset of apps that are AI model providers
-- (id_app must match the AI rows inserted above)
--
-- supports_tool_calling is 1 for every provider: the Sprint 3 backend
-- ships tool-calling adapters for all four provider shapes
-- (OpenAI-compatible / Anthropic / Gemini / Cohere), so every seeded
-- provider can receive tool definitions. The tool schema builder reads
-- this column, not a hardcoded list — set it to 0 for any provider whose
-- adapter is later removed or unsupported.
-- ---------------------------------------------------------------------
INSERT INTO providers (id, id_app, api_base_url, created_at) VALUES
  (1, 1,  'https://api.openai.com/v1',                            CAST(strftime('%s','now') AS INTEGER) * 1000),
  (2, 2,  'https://api.anthropic.com/v1',                         CAST(strftime('%s','now') AS INTEGER) * 1000),
  (3, 3,  'https://api.deepseek.com/v1',                          CAST(strftime('%s','now') AS INTEGER) * 1000),
  (4, 7,  'https://generativelanguage.googleapis.com/v1beta',     CAST(strftime('%s','now') AS INTEGER) * 1000),
  (5, 8,  'https://api.groq.com/openai/v1',                       CAST(strftime('%s','now') AS INTEGER) * 1000),
  (6, 9,  'https://api.mistral.ai/v1',                            CAST(strftime('%s','now') AS INTEGER) * 1000),
  (7, 10, 'https://openrouter.ai/api/v1',                         CAST(strftime('%s','now') AS INTEGER) * 1000),
  (8, 11, 'https://api.cohere.com/v1',                            CAST(strftime('%s','now') AS INTEGER) * 1000);

-- ---------------------------------------------------------------------
-- Initial app status — everything starts disabled until the user
-- connects it (Sprint 1 flow). One history row per app establishes
-- the starting state for current_app_status.
-- ---------------------------------------------------------------------
INSERT INTO historique_apps_status (id_app, is_enabled, modified_at)
SELECT id, 0, CAST(strftime('%s','now') AS INTEGER) * 1000
FROM apps;

-- ---------------------------------------------------------------------
-- Default settings
-- ---------------------------------------------------------------------
INSERT INTO settings (key, label, description, value, modified_at) VALUES
  ('require_confirmation', 'Require confirmation before actions',
   'Ask for approval before the AI performs any action in a connected app.',
   'true', CAST(strftime('%s','now') AS INTEGER) * 1000),

  ('max_tool_calls_per_turn', 'Max chained actions per message',
   'Upper limit on how many tool calls the AI can chain in a single turn.',
   '5', CAST(strftime('%s','now') AS INTEGER) * 1000),

  ('max_requests_per_day', 'Daily request limit',
   'Upper limit on chat requests per day, used as a budget guardrail.',
   '200', CAST(strftime('%s','now') AS INTEGER) * 1000),

  ('voice_output_enabled', 'Read replies aloud',
   'Whether the assistant speaks its replies using on-device text-to-speech.',
   'true', CAST(strftime('%s','now') AS INTEGER) * 1000);

-- ---------------------------------------------------------------------
-- Intentionally empty: ai_models (fetched live per provider on sync),
-- chat, messages, tool_calls, historique_chat_status,
-- historique_message_status, historique_tool_calls_status,
-- attachments, historique_token_usage.
-- ---------------------------------------------------------------------