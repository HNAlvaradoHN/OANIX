create table if not exists public.oanix_recovery_root (
  singleton boolean primary key default true check (singleton),
  secret bytea not null,
  created_at timestamptz not null default now()
);

alter table public.oanix_recovery_root enable row level security;
revoke all on table public.oanix_recovery_root from anon, authenticated;

insert into public.oanix_recovery_root (singleton, secret)
values (true, extensions.gen_random_bytes(32))
on conflict (singleton) do nothing;

create table if not exists public.vault_recovery_envelopes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generation bigint not null check (generation > 0),
  ciphertext text not null check (length(ciphertext) > 0),
  updated_at timestamptz not null default now()
);

alter table public.vault_recovery_envelopes enable row level security;
revoke all on table public.vault_recovery_envelopes from anon, authenticated;

comment on table public.oanix_recovery_root is 'Server-side root secret used only by the OANIX email recovery broker. No client grants or RLS policies.';
comment on table public.vault_recovery_envelopes is 'Per-user encrypted vault-key recovery envelope. Accessed only through the OTP-gated Edge Function.';
