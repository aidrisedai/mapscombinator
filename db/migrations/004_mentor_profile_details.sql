-- Richer mentor/advisor profiles shown to the founders of the cohorts they mentor.
alter table mentor_profiles
  add column headline text not null default '' check (length(headline) <= 160),
  add column linkedin_url text check (linkedin_url is null or linkedin_url like 'https://%'),
  add column calendar_url text check (calendar_url is null or calendar_url like 'https://%'),
  add column interests text not null default '' check (length(interests) <= 1000),
  add column contact_email text check (contact_email is null or (length(contact_email) <= 254 and contact_email like '%_@_%')),
  add column phone text check (phone is null or length(phone) <= 40);
