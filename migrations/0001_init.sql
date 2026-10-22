-- D1 schema for Omar's portfolio.
-- The Worker also runs these statements lazily on first API call, so applying
-- this file by hand is optional.

CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'guestbook',
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_kind ON messages (kind, id DESC);

CREATE TABLE IF NOT EXISTS visitors (
  ip_hash TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS like_ledger (
  ip_hash TEXT NOT NULL,
  project TEXT NOT NULL,
  PRIMARY KEY (ip_hash, project)
);

INSERT OR IGNORE INTO counters (key, value) VALUES
  ('visits', 0),
  ('like:movie', 0),
  ('like:anime', 0),
  ('like:avatar', 0),
  ('like:birthday', 0),
  ('like:portfolio', 0);
