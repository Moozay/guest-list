CREATE TABLE IF NOT EXISTS login_attempts (
  key_hash text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS login_attempts_window_started_at_idx
  ON login_attempts (window_started_at);
