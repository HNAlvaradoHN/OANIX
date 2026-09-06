-- OANIX v2 remote sync keeps only small operational metadata in Supabase.
-- Encrypted record payloads live in the configured object provider (R2 for OANIX-managed storage).

create sequence if not exists public.sync_v2_change_seq;

create table if not exists public.sync_v2_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null,
  object_key text not null,
  revision bigint not null check (revision > 0),
  deleted boolean not null default false,
  content_sha256 text,
  content_bytes bigint check (content_bytes is null or content_bytes >= 0),
  change_seq bigint not null default nextval('public.sync_v2_change_seq'),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_key),
  check (char_length(record_key) between 1 and 200),
  check (char_length(object_key) between 1 and 240)
);

create index if not exists sync_v2_records_user_change_seq_idx
  on public.sync_v2_records (user_id, change_seq);

alter table public.sync_v2_records enable row level security;

create policy sync_v2_records_select_own
  on public.sync_v2_records for select
  using ((select auth.uid()) = user_id);

create policy sync_v2_records_insert_own
  on public.sync_v2_records for insert
  with check ((select auth.uid()) = user_id);

create policy sync_v2_records_update_own
  on public.sync_v2_records for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy sync_v2_records_delete_own
  on public.sync_v2_records for delete
  using ((select auth.uid()) = user_id);

create or replace function public.bump_sync_v2_change_seq()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.change_seq := nextval('public.sync_v2_change_seq');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sync_v2_records_bump_change_seq on public.sync_v2_records;
create trigger sync_v2_records_bump_change_seq
before update on public.sync_v2_records
for each row execute function public.bump_sync_v2_change_seq();

-- Clients never need direct sequence/function execution; they only read/write rows through RLS.
revoke all on sequence public.sync_v2_change_seq from anon, authenticated;
revoke all on function public.bump_sync_v2_change_seq() from public;
