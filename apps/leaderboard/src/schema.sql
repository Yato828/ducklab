CREATE TABLE IF NOT EXISTS ducklab_runs (
 id uuid PRIMARY KEY, digest text UNIQUE NOT NULL, nickname varchar(24) NOT NULL,
 course_id text NOT NULL, config_id text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','verifying','verified','rejected')),
 replay jsonb, result jsonb, error text, milliseconds integer,
 attempts integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, verified_at timestamptz,
 CHECK ((status = 'verified' AND milliseconds > 0 AND result IS NOT NULL) OR (status <> 'verified' AND milliseconds IS NULL))
);
CREATE INDEX IF NOT EXISTS ducklab_verified_times ON ducklab_runs(course_id, config_id, milliseconds, verified_at) WHERE status = 'verified';
CREATE INDEX IF NOT EXISTS ducklab_pending_jobs ON ducklab_runs(created_at) WHERE status IN ('queued','verifying');
CREATE TABLE IF NOT EXISTS ducklab_rate_limits (identity text NOT NULL, window_start timestamptz NOT NULL, submissions integer NOT NULL, PRIMARY KEY(identity,window_start));
