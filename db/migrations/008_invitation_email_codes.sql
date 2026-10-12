-- One-time codes emailed to an invited address. The person must enter one
-- before choosing a password, proving they control the invited inbox.
create table invitation_email_codes (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references invitations(id),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitation_email_codes_recent on invitation_email_codes (invitation_id, created_at desc);
alter table invitation_email_codes enable row level security;
