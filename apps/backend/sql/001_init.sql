CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  is_admin boolean NOT NULL DEFAULT false,
  student_id text,
  name text,
  nickname text,
  email text NOT NULL UNIQUE,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname text;

CREATE TABLE IF NOT EXISTS pending_signups (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  student_id text,
  name text,
  nickname text,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS student_id text;
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS nickname text;

CREATE TABLE IF NOT EXISTS organizations (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  is_private boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT NOW(),
  role text NOT NULL DEFAULT 'member',
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS problems (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  title text NOT NULL,
  description text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  input_description text,
  output_description text,
  sample_inputs text[] NOT NULL DEFAULT '{}',
  sample_outputs text[] NOT NULL DEFAULT '{}',
  time_limit smallint,
  memory_limit smallint,
  organization_id bigint REFERENCES organizations(id) ON DELETE SET NULL,
  conditions text[] NOT NULL DEFAULT '{}',
  published_at timestamptz,
  default_code text,
  deadline timestamptz,
  grade text,
  available_languages text[] NOT NULL DEFAULT '{}',
  source text,
  tags text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id bigint NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  input text NOT NULL,
  output text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problem_assets (
  id bigserial PRIMARY KEY,
  problem_id bigint NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  url text NOT NULL,
  path text NOT NULL,
  section text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problem_submissions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id bigint NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  code text NOT NULL,
  passed_all boolean NOT NULL DEFAULT false,
  stdout_list text[] NOT NULL DEFAULT '{}',
  stderr_list text[] NOT NULL DEFAULT '{}',
  submitted_at timestamptz NOT NULL DEFAULT NOW(),
  passed_time_limit boolean NOT NULL DEFAULT false,
  passed_memory_limit boolean NOT NULL DEFAULT false,
  is_correct boolean NOT NULL DEFAULT false,
  status_code smallint NOT NULL DEFAULT 0,
  memory_kb real NOT NULL DEFAULT 0,
  time_ms integer NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'public',
  cases_total smallint NOT NULL DEFAULT 0,
  cases_done smallint NOT NULL DEFAULT 0,
  language text NOT NULL
);

CREATE TABLE IF NOT EXISTS quizzes (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  time_limit_sec bigint,
  start_at timestamptz,
  end_at timestamptz,
  assignment_mode text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  global_problem_id bigint REFERENCES problems(id) ON DELETE SET NULL,
  published_at timestamptz
);

CREATE TABLE IF NOT EXISTS quiz_problems (
  id bigserial PRIMARY KEY,
  quiz_id bigint NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  problem_id bigint NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_problems_org ON problems(organization_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem ON problem_submissions(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON problem_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_problem ON test_cases(problem_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_org ON quizzes(organization_id);
CREATE INDEX IF NOT EXISTS idx_problem_assets_problem ON problem_assets(problem_id);
