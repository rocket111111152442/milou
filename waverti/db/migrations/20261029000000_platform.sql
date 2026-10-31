-- WAVERTI — socle PostgreSQL auto-hébergé (aucune dépendance à Supabase).
--
-- * Rôle app_user : rôle restreint sous lequel le serveur exécute les LECTURES faites pour le compte
--   d'un utilisateur (withUser) ; la RLS ne lui laisse voir que ses propres lignes.
-- * app.current_user_id() : identifiant de l'utilisateur courant, posé par transaction
--   (set_config('app.user_id', …, true)) — équivalent auto-hébergé de auth.uid().
-- * Identités, sessions, jetons à usage unique et codes de récupération 2FA.
-- Les migrations doivent être exécutées par un rôle autorisé à créer des rôles (une seule fois).

create schema if not exists app;
revoke all on schema app from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin noinherit;
  end if;
end;
$$;
-- Le rôle de connexion du serveur doit pouvoir endosser app_user (SET LOCAL ROLE app_user).
grant app_user to current_user;

create or replace function app.current_user_id() returns uuid
language sql stable
set search_path = ''
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;
grant usage on schema app to app_user;
grant execute on function app.current_user_id() to app_user;

-- ---------------------------------------------------------------------------
-- Identités (remplace auth.users de Supabase)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254 and email = lower(email)),
  email_verified_at timestamptz,
  password_hash text,                       -- scrypt$… (jamais en clair)
  password_changed_at timestamptz,
  totp_secret_enc text,                     -- secret TOTP chiffré (AES-256-GCM, clé hors base)
  totp_pending_enc text,                    -- secret en cours d'activation (non confirmé)
  totp_enabled_at timestamptz,
  totp_last_step bigint,                    -- anti-rejeu : dernier pas TOTP accepté
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_email_key on public.users (email);

-- Sessions : seule l'empreinte SHA-256 du jeton est stockée ; aal = 2 après double authentification.
create table public.user_sessions (
  id text primary key check (id ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.users (id) on delete cascade,
  aal smallint not null default 1 check (aal in (1, 2)),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip_hash text,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300)
);
create index user_sessions_user_idx on public.user_sessions (user_id);
create index user_sessions_expires_idx on public.user_sessions (expires_at);

-- Jetons à usage unique envoyés par e-mail (vérification d'adresse, réinitialisation du mot de passe).
create table public.auth_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.users (id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'reset_password')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index auth_tokens_user_idx on public.auth_tokens (user_id, purpose);

-- Codes de récupération de la double authentification (empreintes HMAC, usage unique).
create table public.mfa_recovery_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique (user_id, code_hash)
);
