-- memories: v2 with tags + FTS5
CREATE TABLE IF NOT EXISTS memories (
  id            TEXT PRIMARY KEY,
  content       TEXT NOT NULL,
  importance    INTEGER DEFAULT 1 CHECK (importance BETWEEN 1 AND 5),
  created_at    INTEGER NOT NULL,
  last_accessed INTEGER NOT NULL,
  access_count  INTEGER DEFAULT 0,
  memory_type   TEXT DEFAULT 'conversation' CHECK (memory_type IN ('conversation', 'fact', 'preference', 'system')),
  tags          TEXT DEFAULT '[]',
  session_id    TEXT DEFAULT ''
);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  content,
  tags,
  content='memories',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
  INSERT INTO memories_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
END;

-- agents: Agent instance configs
CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  personality   TEXT NOT NULL,
  model         TEXT NOT NULL,
  api_key       TEXT NOT NULL,
  base_url      TEXT NOT NULL,
  allowed_paths TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- cron_jobs: scheduled tasks
CREATE TABLE IF NOT EXISTS cron_jobs (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  schedule    TEXT NOT NULL,
  task        TEXT NOT NULL,
  last_run    INTEGER,
  enabled     INTEGER DEFAULT 1,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- facts: extracted meta-facts for deep memory
CREATE TABLE IF NOT EXISTS facts (
  id            TEXT PRIMARY KEY,
  content       TEXT NOT NULL,
  tags          TEXT DEFAULT '[]',
  session_id    TEXT DEFAULT '',
  created_at    INTEGER NOT NULL,
  source_type   TEXT DEFAULT 'extraction' CHECK (source_type IN ('extraction', 'user_input', 'system')),
  importance    INTEGER DEFAULT 3
);

-- FTS5 for facts
CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
  content,
  tags,
  content='facts',
  content_rowid='rowid',
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS facts_fts_insert AFTER INSERT ON facts BEGIN
  INSERT INTO facts_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS facts_fts_delete AFTER DELETE ON facts BEGIN
  INSERT INTO facts_fts(memories_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS facts_fts_update AFTER UPDATE ON facts BEGIN
  INSERT INTO facts_fts(facts_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
  INSERT INTO facts_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
END;

-- indexes
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(last_accessed);
CREATE INDEX IF NOT EXISTS idx_facts_created ON facts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facts_session ON facts(session_id);
