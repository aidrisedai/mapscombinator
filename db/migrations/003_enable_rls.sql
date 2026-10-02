-- Supabase exposes the public schema through its REST API using the anon key.
-- The platform never uses that path: it connects as the table owner (which
-- bypasses RLS) and enforces scope in server code. Enabling RLS with no
-- policies makes the tables unreadable through the anon/authenticated API.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
