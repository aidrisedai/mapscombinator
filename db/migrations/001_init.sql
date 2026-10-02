-- MAPS Incubator Platform — initial schema.
-- Conventions: instants are timestamptz (UTC); program/local calendar dates are
-- `date`; local wall-clock times are `time` plus an IANA timezone. Historical
-- records are archived/state-changed, never cascaded away.

create extension if not exists btree_gist;

-- ───────────────────────────── Organization & accounts ─────────────────────

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 160),
  support_email text,
  reply_to_email text,
  invitation_valid_days int not null default 7 check (invitation_valid_days between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  auth_subject text not null unique,
  email text not null unique check (email = lower(email)),
  display_name text not null check (length(display_name) between 1 and 120),
  is_owner boolean not null default false,
  state text not null default 'active' check (state in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────────── Cohorts ─────────────────────────────────────

create table cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null check (length(name) between 1 and 160),
  description text not null default '' check (length(description) <= 2000),
  start_date date not null,
  week_count int not null default 12 check (week_count between 1 and 52),
  timezone text not null default 'America/Los_Angeles',
  support_email text,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  version int not null default 1,
  created_by uuid references accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cohort_roles (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id),
  account_id uuid not null references accounts(id),
  role text not null check (role in ('admin', 'mentor', 'viewer')),
  active boolean not null default true,
  granted_by uuid references accounts(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references accounts(id)
);
create unique index cohort_roles_effective on cohort_roles (cohort_id, account_id, role) where active;
create index cohort_roles_account on cohort_roles (account_id) where active;

create table program_weeks (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id),
  number int not null check (number between 1 and 52),
  start_date date not null,
  end_date date not null,
  content_state text not null default 'none' check (content_state in ('none', 'draft', 'published', 'unpublished')),
  draft_revision_id uuid,
  published_revision_id uuid,
  first_published_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (cohort_id, number),
  unique (id, cohort_id),
  check (end_date = start_date + 6)
);

create table week_content_revisions (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references program_weeks(id),
  revision int not null,
  title text not null default '' check (length(title) <= 160),
  objective text not null default '' check (length(objective) <= 1000),
  instructions text not null default '' check (length(instructions) <= 8000),
  deliverable text not null default '' check (length(deliverable) <= 2000),
  author_id uuid not null references accounts(id),
  created_at timestamptz not null default now(),
  unique (week_id, revision)
);
alter table program_weeks add foreign key (draft_revision_id) references week_content_revisions(id);
alter table program_weeks add foreign key (published_revision_id) references week_content_revisions(id);

create table week_resources (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null,
  week_id uuid not null,
  kind text not null check (kind in ('link', 'file')),
  label text not null check (length(label) between 1 and 160),
  url text check (url is null or url like 'https://%'),
  storage_key text unique,
  filename text,
  content_type text,
  size_bytes bigint,
  state text not null default 'ready' check (state in ('pending', 'ready', 'failed', 'removed')),
  replaces_resource_id uuid references week_resources(id),
  sort_order int not null default 0,
  created_by uuid not null references accounts(id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  foreign key (week_id, cohort_id) references program_weeks(id, cohort_id),
  check ((kind = 'link' and url is not null) or (kind = 'file' and storage_key is not null))
);
create index week_resources_week on week_resources (week_id) where state = 'ready';

-- ───────────────────────────── Startups & membership ───────────────────────

create table startups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null check (length(name) between 1 and 120),
  description text not null check (length(description) between 1 and 500),
  website text check (website is null or website like 'https://%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references startups(id),
  cohort_id uuid not null references cohorts(id),
  contact_name text not null check (length(contact_name) between 1 and 120),
  contact_email text not null check (contact_email = lower(contact_email)),
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (startup_id, cohort_id),
  unique (id, cohort_id)
);
create index enrollments_cohort on enrollments (cohort_id);

-- Named people an admin listed for a startup (primary contact and cofounders)
-- before or alongside invitations. Contact data only — not credentials.
create table enrollment_contacts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id),
  name text not null check (length(name) between 1 and 120),
  email text not null check (email = lower(email)),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (enrollment_id, email)
);

create table startup_memberships (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id),
  account_id uuid not null references accounts(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references accounts(id),
  unique (enrollment_id, account_id)
);
create index startup_memberships_account on startup_memberships (account_id) where active;

create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  email text not null check (email = lower(email)),
  invitee_name text,
  role text not null check (role in ('owner', 'admin', 'mentor', 'viewer', 'founder')),
  cohort_id uuid references cohorts(id),
  enrollment_id uuid references enrollments(id),
  invited_by uuid references accounts(id),
  token_hash text not null unique,
  state text not null default 'queued' check (state in ('queued', 'sent', 'accepted', 'expired', 'revoked', 'delivery_failed')),
  delivery_state text not null default 'queued',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_sent_at timestamptz,
  send_count int not null default 0,
  accepted_at timestamptz,
  accepted_account_id uuid references accounts(id),
  revoked_at timestamptz,
  revoked_by uuid references accounts(id),
  check ((role = 'owner' and cohort_id is null and enrollment_id is null)
      or (role in ('admin', 'mentor', 'viewer') and cohort_id is not null and enrollment_id is null)
      or (role = 'founder' and cohort_id is not null and enrollment_id is not null)),
  foreign key (enrollment_id, cohort_id) references enrollments(id, cohort_id)
);
-- One open invitation per person/scope/role; resend rotates its token.
create unique index invitations_open on invitations (email, role, coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(enrollment_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where state in ('queued', 'sent', 'delivery_failed');
create index invitations_cohort on invitations (cohort_id);

-- ───────────────────────────── Team updates ────────────────────────────────

create table team_updates (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null,
  enrollment_id uuid not null,
  kind text not null check (kind in ('daily', 'weekly')),
  report_date date,
  week_number int,
  state text not null default 'draft' check (state in ('draft', 'published')),
  content jsonb not null default '{}'::jsonb,
  current_revision int not null default 0,
  lock_version int not null default 1,
  first_published_at timestamptz,
  last_published_at timestamptz,
  edited_after_publish boolean not null default false,
  created_by uuid not null references accounts(id),
  last_editor_id uuid not null references accounts(id),
  hidden_at timestamptz,
  hidden_by uuid references accounts(id),
  hidden_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (enrollment_id, cohort_id) references enrollments(id, cohort_id),
  check ((kind = 'daily' and report_date is not null and week_number is not null)
      or (kind = 'weekly' and report_date is null and week_number is not null))
);
create unique index team_updates_daily_once on team_updates (enrollment_id, report_date) where kind = 'daily';
create unique index team_updates_weekly_once on team_updates (enrollment_id, week_number) where kind = 'weekly';
create index team_updates_feed on team_updates (cohort_id, state, last_published_at desc);

create table update_revisions (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references team_updates(id),
  revision int not null,
  state text not null check (state in ('draft', 'published')),
  content jsonb not null,
  author_id uuid not null references accounts(id),
  created_at timestamptz not null default now(),
  unique (update_id, revision)
);

create function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'immutable history table: %', tg_table_name;
end $$;
create trigger update_revisions_immutable before update or delete on update_revisions
  for each row execute function forbid_mutation();
create trigger week_content_revisions_immutable before update or delete on week_content_revisions
  for each row execute function forbid_mutation();

-- ───────────────────────────── Office hours (group) ────────────────────────

create table office_hours_series (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id),
  first_local_date date not null,
  local_start_time time not null,
  duration_minutes int not null check (duration_minutes between 5 and 480),
  timezone text not null,
  occurrence_count int not null check (occurrence_count between 1 and 52),
  created_by uuid not null references accounts(id),
  created_at timestamptz not null default now()
);

create table office_hours_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id),
  week_id uuid,
  series_id uuid references office_hours_series(id),
  series_position int,
  title text not null check (length(title) between 1 and 160),
  host_name text not null default '' check (length(host_name) <= 120),
  host_account_id uuid references accounts(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  mode text not null check (mode in ('online', 'in_person', 'hybrid')),
  meeting_url text check (meeting_url is null or meeting_url like 'https://%'),
  location text check (location is null or length(location) <= 300),
  description text not null default '' check (length(description) <= 4000),
  preparation text not null default '' check (length(preparation) <= 2000),
  state text not null default 'draft' check (state in ('draft', 'published', 'cancelled')),
  cancel_reason text,
  revision int not null default 1,
  published_at timestamptz,
  last_notified_at timestamptz,
  created_by uuid not null references accounts(id),
  updated_by uuid not null references accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, cohort_id),
  check (ends_at > starts_at),
  foreign key (week_id, cohort_id) references program_weeks(id, cohort_id)
);
create index office_hours_sessions_cohort on office_hours_sessions (cohort_id, starts_at);
create index office_hours_sessions_host on office_hours_sessions (host_account_id, starts_at) where state = 'published';

create table office_hours_session_revisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references office_hours_sessions(id),
  revision int not null,
  snapshot jsonb not null,
  actor_id uuid not null references accounts(id),
  created_at timestamptz not null default now(),
  unique (session_id, revision)
);
create trigger office_hours_session_revisions_immutable before update or delete on office_hours_session_revisions
  for each row execute function forbid_mutation();

-- ───────────────────────────── Mentors & bookings ──────────────────────────

create table mentor_profiles (
  account_id uuid primary key references accounts(id),
  bio text not null default '' check (length(bio) <= 1500),
  expertise text[] not null default '{}',
  timezone text not null default 'America/Los_Angeles',
  meeting_url text check (meeting_url is null or meeting_url like 'https://%'),
  meeting_instructions text not null default '' check (length(meeting_instructions) <= 1000),
  updated_by uuid references accounts(id),
  updated_at timestamptz not null default now()
);

create table cohort_booking_policies (
  cohort_id uuid primary key references cohorts(id),
  allowed_durations int[] not null default '{15}',
  default_duration int not null default 15,
  horizon_days int not null default 28 check (horizon_days between 1 and 180),
  buffer_minutes int not null default 0 check (buffer_minutes between 0 and 120),
  cancellation_window_minutes int not null default 120 check (cancellation_window_minutes between 0 and 10080),
  active_booking_limit int not null default 2 check (active_booking_limit between 1 and 50),
  version int not null default 1,
  updated_by uuid references accounts(id),
  updated_at timestamptz not null default now()
);

create table mentor_availability_rules (
  id uuid primary key default gen_random_uuid(),
  mentor_account_id uuid not null references accounts(id),
  kind text not null check (kind in ('single', 'weekly')),
  timezone text not null,
  start_date date not null,
  end_date date not null,
  weekday int check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  duration_minutes int not null default 15 check (duration_minutes between 5 and 240),
  buffer_minutes int not null default 0 check (buffer_minutes between 0 and 120),
  horizon_days int not null default 28 check (horizon_days between 1 and 180),
  ambiguous_offset text not null default 'earlier' check (ambiguous_offset in ('earlier', 'later')),
  location text check (location is null or length(location) <= 300),
  meeting_url text check (meeting_url is null or meeting_url like 'https://%'),
  state text not null default 'active' check (state in ('active', 'retired')),
  version int not null default 1,
  created_by uuid not null references accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (end_date >= start_date),
  check ((kind = 'single' and end_date = start_date) or (kind = 'weekly' and weekday is not null))
);

create table availability_rule_cohorts (
  rule_id uuid not null references mentor_availability_rules(id),
  cohort_id uuid not null references cohorts(id),
  primary key (rule_id, cohort_id)
);

create table availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  mentor_account_id uuid not null references accounts(id),
  rule_id uuid references mentor_availability_rules(id),
  local_date date not null,
  kind text not null check (kind in ('unavailable', 'replacement')),
  start_time time,
  end_time time,
  created_by uuid not null references accounts(id),
  created_at timestamptz not null default now(),
  check (kind = 'unavailable' or (start_time is not null and end_time is not null and end_time > start_time))
);

-- Canonical, single reservable mentor/time resource. Cohort eligibility is a
-- mapping, never separate inventory.
create table appointment_slots (
  id uuid primary key default gen_random_uuid(),
  mentor_account_id uuid not null references accounts(id),
  rule_id uuid references mentor_availability_rules(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  buffer_minutes int not null default 0,
  timezone text not null,
  location text,
  meeting_url text,
  state text not null default 'offered' check (state in ('offered', 'withdrawn')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (mentor_account_id, starts_at, ends_at)
);
alter table appointment_slots add constraint appointment_slots_no_overlap
  exclude using gist (mentor_account_id with =, tstzrange(starts_at, ends_at) with &&) where (state = 'offered');
create index appointment_slots_mentor on appointment_slots (mentor_account_id, starts_at);

create table appointment_slot_cohorts (
  slot_id uuid not null references appointment_slots(id),
  cohort_id uuid not null references cohorts(id),
  primary key (slot_id, cohort_id)
);
create index appointment_slot_cohorts_cohort on appointment_slot_cohorts (cohort_id);

create table appointment_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references appointment_slots(id),
  cohort_id uuid not null,
  enrollment_id uuid not null,
  mentor_account_id uuid not null references accounts(id),
  booked_by uuid not null references accounts(id),
  topic text not null check (length(topic) between 1 and 200),
  help_needed text not null default '' check (length(help_needed) <= 2000),
  link text check (link is null or link like 'https://%'),
  state text not null default 'confirmed' check (state in ('confirmed', 'cancelled', 'completed', 'no_show')),
  idempotency_key text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  buffer_minutes int not null default 0,
  -- Buffered interval used for mentor overlap prevention (computed by the app).
  blocked_start timestamptz not null,
  blocked_end timestamptz not null,
  policy_snapshot jsonb not null,
  cancellation_reason text,
  cancelled_by uuid references accounts(id),
  cancelled_at timestamptz,
  replaces_booking_id uuid references appointment_bookings(id),
  replaced_by_booking_id uuid references appointment_bookings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (enrollment_id, cohort_id) references enrollments(id, cohort_id),
  check (ends_at > starts_at),
  check (blocked_start <= starts_at and blocked_end >= ends_at)
);
create unique index appointment_bookings_one_per_slot on appointment_bookings (slot_id) where state = 'confirmed';
alter table appointment_bookings add constraint appointment_bookings_mentor_no_overlap
  exclude using gist (mentor_account_id with =,
    tstzrange(blocked_start, blocked_end) with &&)
  where (state = 'confirmed');
alter table appointment_bookings add constraint appointment_bookings_startup_no_overlap
  exclude using gist (enrollment_id with =, tstzrange(starts_at, ends_at) with &&) where (state = 'confirmed');
create index appointment_bookings_enrollment on appointment_bookings (enrollment_id, starts_at);
create index appointment_bookings_mentor on appointment_bookings (mentor_account_id, starts_at);

create table booking_changes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references appointment_bookings(id),
  actor_id uuid not null references accounts(id),
  event text not null,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create trigger booking_changes_immutable before update or delete on booking_changes
  for each row execute function forbid_mutation();

-- ───────────────────────────── Announcements ───────────────────────────────

create table announcements (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id),
  week_id uuid,
  session_id uuid,
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) between 1 and 6000),
  link text check (link is null or link like 'https://%'),
  state text not null default 'draft' check (state in ('draft', 'published')),
  pinned boolean not null default false,
  publish_at timestamptz,
  expires_at timestamptz,
  revision int not null default 1,
  author_id uuid not null references accounts(id),
  updated_by uuid not null references accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (week_id, cohort_id) references program_weeks(id, cohort_id),
  foreign key (session_id, cohort_id) references office_hours_sessions(id, cohort_id)
);
create index announcements_cohort on announcements (cohort_id, state, publish_at desc);

-- ───────────────────────────── Email outbox ────────────────────────────────

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  cohort_id uuid references cohorts(id),
  authorized_by uuid references accounts(id),
  recipient_email text not null,
  recipient_account_id uuid references accounts(id),
  template text not null,
  template_version int not null default 1,
  payload jsonb not null default '{}'::jsonb,
  -- Secrets needed only to render a pending message (e.g. a single-use link).
  -- Cleared once the message reaches a terminal state.
  secret_payload jsonb,
  related_type text,
  related_id uuid,
  idempotency_key text not null unique,
  state text not null default 'queued' check (state in ('queued', 'sending', 'provider_accepted', 'delivered', 'bounced', 'complained', 'failed', 'suppressed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  attempted_at timestamptz,
  provider_message_id text unique,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_outbox_pending on email_outbox (next_attempt_at) where state = 'queued';
create index email_outbox_related on email_outbox (related_type, related_id);
create index email_outbox_cohort on email_outbox (cohort_id, created_at desc);

create table email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  provider_message_id text,
  event_type text not null,
  received_at timestamptz not null default now()
);

-- ───────────────────────────── Audit & rate limiting ───────────────────────

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references accounts(id),
  action text not null,
  object_type text not null,
  object_id uuid,
  cohort_id uuid references cohorts(id),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_cohort on audit_events (cohort_id, created_at desc);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- Pending-invitation help requests from expired/revoked links. Never creates
-- membership and never reveals whether an address has an account.
create table invitation_help_requests (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references invitations(id),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
