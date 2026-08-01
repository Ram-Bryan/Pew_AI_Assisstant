PRAGMA foreign_keys = ON;

-- Status reference tables
CREATE TABLE status_chat (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL CHECK(label IN ('active','archived','deleted'))
);

CREATE TABLE status_message (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL CHECK(label IN ('active','deleted'))
);

CREATE TABLE status_tool_call (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL CHECK(label IN ('pending','approved','rejected','completed','failed'))
);

-- Apps (all integrations)
-- connect_url: provider-side authorization/consent URL for oauth apps;
-- NULL for api_key apps (they connect by entering a key).
CREATE TABLE apps (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  auth_type TEXT NOT NULL CHECK(auth_type IN ('api_key','oauth')),
  docs TEXT
);

-- App enable/disable history
CREATE TABLE historique_apps_status (
  id INTEGER PRIMARY KEY,
  id_app INTEGER NOT NULL REFERENCES apps(id),
  is_enabled BOOLEAN NOT NULL CHECK(is_enabled IN (0,1)),
  modified_at INTEGER NOT NULL
);
CREATE INDEX idx_historique_apps_status_app ON historique_apps_status(id_app);

-- AI Providers (subset of apps)
CREATE TABLE providers (
  id INTEGER PRIMARY KEY,
  id_app INTEGER NOT NULL UNIQUE REFERENCES apps(id),
  api_base_url TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- AI Models (fetched dynamically)
CREATE TABLE ai_models (
  id INTEGER PRIMARY KEY,
  id_provider INTEGER NOT NULL REFERENCES providers(id),
  raw_name TEXT NOT NULL,
  display_name TEXT,
  is_available BOOLEAN DEFAULT 1,
  fetched_at INTEGER NOT NULL,
  UNIQUE(id_provider, raw_name)
);

-- Chat (locked to one model)
CREATE TABLE chat (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  id_model INTEGER NOT NULL REFERENCES ai_models(id),
  created_at INTEGER NOT NULL
);

-- Chat status history
CREATE TABLE historique_chat_status (
  id INTEGER PRIMARY KEY,
  id_chat INTEGER NOT NULL REFERENCES chat(id),
  id_status INTEGER NOT NULL REFERENCES status_chat(id),
  modified_at INTEGER NOT NULL
);
CREATE INDEX idx_hist_chat_status_chat ON historique_chat_status(id_chat);

-- Messages
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  id_chat INTEGER NOT NULL REFERENCES chat(id),
  content TEXT,
  role TEXT NOT NULL CHECK(role IN ('user','ai','tool')),
  id_tool_call INTEGER REFERENCES tool_calls(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_chat ON messages(id_chat);
CREATE INDEX idx_messages_tool_call ON messages(id_tool_call);

-- Message status history
CREATE TABLE historique_message_status (
  id INTEGER PRIMARY KEY,
  id_message INTEGER NOT NULL REFERENCES messages(id),
  id_status INTEGER NOT NULL REFERENCES status_message(id),
  modified_at INTEGER NOT NULL
);
CREATE INDEX idx_hist_msg_status_msg ON historique_message_status(id_message);

-- Tool calls
CREATE TABLE tool_calls (
  id INTEGER PRIMARY KEY,
  id_message INTEGER NOT NULL REFERENCES messages(id),
  id_app INTEGER NOT NULL REFERENCES apps(id),
  tool_name TEXT NOT NULL,
  request JSON NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_tool_calls_message ON tool_calls(id_message);

-- Tool call status history
CREATE TABLE historique_tool_calls_status (
  id INTEGER PRIMARY KEY,
  id_tool_call INTEGER NOT NULL REFERENCES tool_calls(id),
  id_status INTEGER NOT NULL REFERENCES status_tool_call(id),
  modified_at INTEGER NOT NULL
);
CREATE INDEX idx_hist_tool_call_status ON historique_tool_calls_status(id_tool_call);

-- Attachments (audio, images)
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY,
  id_message INTEGER NOT NULL REFERENCES messages(id),
  file_name TEXT NOT NULL
);
CREATE INDEX idx_attachments_message ON attachments(id_message);

-- Token usage (LLM only)
CREATE TABLE historique_token_usage (
  id INTEGER PRIMARY KEY,
  id_model INTEGER NOT NULL REFERENCES ai_models(id),
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  id_chat INTEGER REFERENCES chat(id),
  created_at INTEGER NOT NULL
);

-- Settings
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  value TEXT NOT NULL,
  modified_at INTEGER NOT NULL
);

-- Views
CREATE VIEW current_app_status AS
SELECT a.id_app, a.is_enabled
FROM historique_apps_status a
WHERE a.modified_at = (
  SELECT MAX(modified_at) FROM historique_apps_status a2 WHERE a2.id_app = a.id_app
);

CREATE VIEW current_chat_status AS
SELECT h.id_chat, h.id_status
FROM historique_chat_status h
WHERE h.modified_at = (
  SELECT MAX(modified_at) FROM historique_chat_status h2 WHERE h2.id_chat = h.id_chat
);

CREATE VIEW current_message_status AS
SELECT h.id_message, h.id_status
FROM historique_message_status h
WHERE h.modified_at = (
  SELECT MAX(modified_at) FROM historique_message_status h2 WHERE h2.id_message = h.id_message
);

CREATE VIEW current_tool_call_status AS
SELECT h.id_tool_call, h.id_status
FROM historique_tool_calls_status h
WHERE h.modified_at = (
  SELECT MAX(modified_at) FROM historique_tool_calls_status h2 WHERE h2.id_tool_call = h.id_tool_call
);