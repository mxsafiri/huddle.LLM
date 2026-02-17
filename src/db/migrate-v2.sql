-- V2: Add session codes and participants for multi-user huddles

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_code VARCHAR(16) UNIQUE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS creator_id VARCHAR(64);

CREATE TABLE IF NOT EXISTS participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     VARCHAR(64) NOT NULL,
  user_name   VARCHAR(128),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(session_code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);
