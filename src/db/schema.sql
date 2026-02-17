-- Huddle Database Schema

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      VARCHAR(64) NOT NULL,
  session_code  VARCHAR(16) UNIQUE,
  creator_id    VARCHAR(64),
  status        VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
  language      VARCHAR(8)  NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'sw')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  closed_at     TIMESTAMPTZ,
  summary       TEXT,
  UNIQUE (group_id, status) -- one active session per group
);

CREATE TABLE IF NOT EXISTS participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     VARCHAR(64) NOT NULL,
  user_name   VARCHAR(128),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS contributors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id         VARCHAR(64) NOT NULL,
  user_name       VARCHAR(128),
  amount          NUMERIC(15, 2),
  commitment_text TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_group_status ON sessions(group_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(session_code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_contributors_session ON contributors(session_id);
