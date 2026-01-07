PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  source_conversation_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_updated_at
  ON resumes (user_id, updated_at);

CREATE TABLE IF NOT EXISTS resume_versions (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  resume_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resume_versions_resume_created_at
  ON resume_versions (resume_id, created_at);

CREATE INDEX IF NOT EXISTS idx_resume_versions_user_created_at
  ON resume_versions (user_id, created_at);

ALTER TABLE conversations ADD COLUMN context_resume_id TEXT REFERENCES resumes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_context_resume_id
  ON conversations (context_resume_id);

