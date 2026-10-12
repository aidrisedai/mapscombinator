-- Profile details an admin entered when inviting an advisor; copied into
-- their mentor profile when they accept (only into empty fields).
alter table invitations add column profile_prefill jsonb;
