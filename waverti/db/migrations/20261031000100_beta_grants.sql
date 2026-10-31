-- WAVERTI — Accès bêta privé, sans paiement.
--
-- * Accordé uniquement en ligne de commande par LULLIN WEB (pnpm beta:grant), jamais depuis le site :
--   aucune route ni aucun rôle applicatif ne peut écrire dans cette table (RLS, aucun droit pour app_user).
-- * Durée limitée (60 jours au plus) et expiration automatique (droits recalculés par le worker).
-- * Quotas stricts, inférieurs à ceux de la formule de référence (cf. billing/entitlements.ts : BETA_CAPS).
-- * Un abonnement réel est toujours prioritaire. Ce n'est pas une formule gratuite commerciale.
create table public.beta_grants (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id),
  reason text not null check (char_length(reason) between 3 and 300),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  granted_by text not null default 'ligne de commande',
  created_at timestamptz not null default now(),
  constraint beta_grants_duration check (expires_at > starts_at and expires_at <= starts_at + interval '60 days')
);
alter table public.beta_grants enable row level security;
revoke all on public.beta_grants from app_user;
