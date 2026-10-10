-- Editable automatic emails per cohort, saved message templates, and one-off messages to startups.
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id),
  kind text not null check (kind in ('acceptance', 'founder_welcome', 'mentor_invitation', 'mentor_welcome', 'saved')),
  name text not null default '' check (length(name) <= 120),
  subject text not null check (length(subject) between 1 and 200),
  body text not null check (length(body) between 1 and 10000),
  updated_by uuid references accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index email_templates_one_per_kind on email_templates (cohort_id, kind) where kind <> 'saved';

create table cohort_messages (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id),
  subject text not null check (length(subject) between 1 and 200),
  body text not null check (length(body) between 1 and 10000),
  audience text not null check (audience in ('all', 'selected', 'missing_weekly')),
  enrollment_ids uuid[] not null default '{}',
  include_mentors boolean not null default false,
  recipient_count int not null default 0,
  sent_by uuid not null references accounts(id),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index cohort_messages_cohort on cohort_messages (cohort_id, created_at desc);

alter table email_templates enable row level security;
alter table cohort_messages enable row level security;
