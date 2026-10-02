-- Development/test-only credential store used when AUTH_PROVIDER=local.
-- Production configuration refuses AUTH_PROVIDER=local (see lib/server/env.ts);
-- these tables then stay empty.
create table local_auth_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table local_auth_sessions (
  token_hash text primary key,
  user_id uuid not null references local_auth_users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table local_auth_tokens (
  token_hash text primary key,
  user_id uuid not null references local_auth_users(id),
  type text not null check (type in ('recovery', 'email_change')),
  new_email text,
  expires_at timestamptz not null,
  used_at timestamptz
);
