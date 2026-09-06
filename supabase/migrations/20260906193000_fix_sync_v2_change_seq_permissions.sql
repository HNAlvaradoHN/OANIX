-- sync_v2_records uses nextval(sync_v2_change_seq) both on INSERT and in the update trigger.
-- Authenticated clients still write only through RLS-protected rows, but PostgreSQL requires
-- USAGE on the sequence for nextval() to succeed.

revoke all on sequence public.sync_v2_change_seq from anon;
grant usage on sequence public.sync_v2_change_seq to authenticated;
