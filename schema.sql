PRAGMA foreign_keys = ON;

CREATE TABLE status_chat (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL CHECK(label IN ('active','archived','deleted'))
);

CREATE TABLE chat (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE historique_chat_status (
  id INTEGER PRIMARY KEY,
  id_chat TEXT NOT NULL REFERENCES chat(id),
  id_status INTEGER NOT NULL REFERENCES status_chat(id),
  modified_at INTEGER NOT NULL
);
CREATE INDEX idx_hist_chat_status_chat ON historique_chat_status(id_chat);

CREATE TABLE status_message (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL CHECK(label IN ('active','deleted'))
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  id_chat TEXT NOT NULL REFERENCES chat(id),
  content TEXT,
  role TEXT NOT NULL CHECK(role IN ('user','ai')),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_chat ON messages(id_chat);

CREATE TABLE historique_message_status (
  id INTEGER PRIMARY KEY,
  id_message TEXT NOT NULL REFERENCES messages(id),
  id_status INTEGER NOT NULL REFERENCES status_message(id),
  modified_at INTEGER NOT NULL
);
CREATE INDEX idx_hist_msg_status_msg ON historique_message_status(id_message);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  id_message TEXT NOT NULL REFERENCES messages(id),
  file_name TEXT NOT NULL 
);
CREATE INDEX idx_attachments_message ON attachments(id_message);

CREATE TABLE apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url_docs TEXT,
  auth_type TEXT NOT NULL CHECK(auth_type IN ('api_key','oauth'))
);

-- Convenience views so "current status" is a single read, not a
-- hand-written subquery scattered across every screen:
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