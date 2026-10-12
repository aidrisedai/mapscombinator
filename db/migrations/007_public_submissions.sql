-- Forms submitted on the public website (Get Involved, Combinator interest).
create table public_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contribution', 'combinator_interest')),
  category text not null check (length(category) between 1 and 80),
  name text not null check (length(name) between 1 and 120),
  email text not null check (email = lower(email) and length(email) <= 254),
  answers jsonb not null default '[]'::jsonb, -- ordered [{label, value}]
  consent boolean not null default false,
  source_page text not null default '' check (length(source_page) <= 300),
  status text not null default 'new' check (status in ('new', 'contacted', 'done', 'archived')),
  admin_note text not null default '' check (length(admin_note) <= 4000),
  handled_by uuid references accounts(id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index public_submissions_recent on public_submissions (created_at desc);
create index public_submissions_status on public_submissions (status, created_at desc);
alter table public_submissions enable row level security;
