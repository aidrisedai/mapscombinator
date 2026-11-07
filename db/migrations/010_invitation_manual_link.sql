-- A second, separate link an administrator copies and sends personally
-- (WhatsApp, text, their own email). Getting a new one replaces only the
-- previous copied link; the emailed link keeps working.
alter table invitations
  add column manual_token_hash text unique,
  add column manual_link_at timestamptz;
