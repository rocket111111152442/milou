-- Le Pétrin de Pépiole : stockage des commandes, réglages, appareils notifiés et photos.
-- Script idempotent, appliqué à chaque build par scripts/migrate.mjs.
-- Tables préfixées « petrin_ » : la base est partagée avec d'autres projets.

create table if not exists petrin_settings (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists petrin_orders (
  order_number text primary key,
  created_at timestamptz not null,
  status text not null,
  data jsonb not null
);
create index if not exists petrin_orders_created_idx on petrin_orders (created_at desc);

create table if not exists petrin_push_devices (
  key text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Photos des produits ajoutés depuis /admin (4 Mo maximum, encodées en base64)
create table if not exists petrin_photos (
  name text primary key,
  content_type text not null,
  data text not null,
  created_at timestamptz not null default now()
);

-- Accès réservé au serveur : RLS activée sans aucune politique, et rien pour les rôles publics de Supabase.
alter table petrin_settings enable row level security;
alter table petrin_orders enable row level security;
alter table petrin_push_devices enable row level security;
alter table petrin_photos enable row level security;

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table petrin_settings, petrin_orders, petrin_push_devices, petrin_photos from %I', r);
    end if;
  end loop;
end $$;
