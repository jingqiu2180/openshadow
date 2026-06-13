-- memories: 记忆存储表
CREATE TABLE IF NOT EXISTS memories (
  id            TEXT PRIMARY KEY,
  content       TEXT NOT NULL,
  importance    INTEGER DEFAULT 1 CHECK (importance BETWEEN 1 AND 5),
  created_at    INTEGER NOT NULL,
  last_accessed INTEGER NOT NULL,
  access_count  INTEGER DEFAULT 0,
  memory_type   TEXT DEFAULT 'conversation' CHECK (memory_type IN ('conversation', 'fact', 'preference', 'system'))
);

-- agents: Agent 实例配置表
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

-- cron_jobs: 定时任务表
CREATE TABLE IF NOT EXISTS cron_jobs (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  schedule    TEXT NOT NULL,
  task        TEXT NOT NULL,
  last_run    INTEGER,
  enabled     INTEGER DEFAULT 1,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(last_accessed);
