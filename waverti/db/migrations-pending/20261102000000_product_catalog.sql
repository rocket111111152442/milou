-- WAVERTI — Catalogue de produits (PRÉPARÉ, NON APPLIQUÉ : voir db/migrations-pending/README.md).
--
-- Objet : conserver, pour la comparaison multi-boutiques, les identités de produits, les marchands, les offres, les prix
-- VÉRIFIÉS sur les fiches marchandes (prix, devise, état, disponibilité, frais), l'historique des variations, les dates de
-- vérification et la provenance.
--
-- Garde-fous contractuels (fail-closed) :
--  1. `source_policies` : chaque source de données doit être explicitement autorisée AVEC une référence de justificatif
--     (contrat, e-mail du fournisseur) avant toute écriture. Par défaut TOUTES les sources sont refusées : la base est inerte.
--  2. Les conditions de Brave Search API (§3(b)(i)) interdisent de conserver les résultats de recherche (adresses comprises)
--     sans droits de stockage : une offre découverte par Brave ne peut avoir d'adresse (`url`) que si la source `brave` est
--     autorisée ; sinon seule l'empreinte de l'adresse (`url_hash`) est conservée.
--  3. Aucune donnée personnelle : aucune table ne référence un utilisateur.
-- Tables d'exploitation : accessibles au serveur uniquement (RLS activée, aucun droit pour app_user).

-- ————————————————————————— Règles de source —————————————————————————
create table public.source_policies (
  source text primary key check (source in ('brave', 'merchant_page', 'user_supplied', 'import')),
  storage_allowed boolean not null default false,
  evidence_ref text,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  notes text,
  updated_at timestamptz not null default now(),
  constraint source_policies_evidence check (
    not storage_allowed or (confirmed_at is not null and evidence_ref is not null and length(btrim(evidence_ref)) >= 6)
  )
);
insert into public.source_policies (source, storage_allowed, notes) values
  ('brave', false, 'Résultats Brave Search API : stockage interdit sans droits explicites (conditions §3(b)(i)).'),
  ('merchant_page', false, 'Données lues sur les fiches publiques des marchands : conservation à valider juridiquement (conditions des sites, droit sur les bases de données).'),
  ('user_supplied', false, 'Adresses fournies par l''utilisateur.'),
  ('import', false, 'Imports de catalogue (flux marchands).');

-- ————————————————————————— Identités de produits —————————————————————————
create table public.product_identities (
  id uuid primary key default gen_random_uuid(),
  identity_key text not null unique check (length(identity_key) between 3 and 400),
  brand text check (brand is null or length(brand) <= 120),
  name text not null check (length(name) between 1 and 300),
  model text check (model is null or length(model) <= 120),
  mpn text check (mpn is null or length(mpn) <= 80),
  gtin text check (gtin is null or gtin ~ '^[0-9]{14}$'),
  variant jsonb not null default '{}'::jsonb check (jsonb_typeof(variant) = 'object' and pg_column_size(variant) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index product_identities_gtin_key on public.product_identities (gtin) where gtin is not null;
create index product_identities_brand_mpn_idx on public.product_identities (lower(brand), upper(mpn)) where mpn is not null;

-- ————————————————————————— Marchands —————————————————————————
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (domain = lower(domain) and domain ~ '^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$'),
  display_name text not null check (length(display_name) between 1 and 200),
  is_marketplace boolean not null default false,
  robots_checked_at timestamptz,
  created_at timestamptz not null default now()
);

-- ————————————————————————— Offres (un produit chez un marchand, à une adresse) —————————————————————————
create table public.product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.product_identities (id) on delete cascade,
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  marketplace_seller text check (marketplace_seller is null or length(marketplace_seller) <= 200),
  url_hash text not null check (url_hash ~ '^[0-9a-f]{64}$'),
  -- Adresse de la fiche. NULL quand sa conservation n'est pas autorisée (voir le déclencheur de politique).
  url text check (url is null or (length(url) <= 2048 and url ~ '^https?://')),
  condition text not null default 'unknown' check (condition in ('new', 'refurbished', 'used', 'unknown')),
  discovery_origin text not null check (discovery_origin in ('brave', 'merchant_crawl', 'user_supplied', 'import')),
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_status text not null default 'pending' check (last_status in ('pending', 'ok', 'failed')),
  last_failure_reason text check (last_failure_reason is null or length(last_failure_reason) <= 60),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  active boolean not null default true,
  -- Instantané de la dernière observation (tenu à jour par le déclencheur apply_offer_observation).
  current_price_cents bigint check (current_price_cents is null or current_price_cents > 0),
  current_currency char(3) check (current_currency is null or current_currency ~ '^[A-Z]{3}$'),
  current_availability text check (current_availability is null or current_availability in ('in_stock', 'out_of_stock', 'preorder', 'limited', 'unknown')),
  current_shipping_kind text check (current_shipping_kind is null or current_shipping_kind in ('free', 'known', 'unknown', 'unavailable')),
  current_shipping_cents bigint check (current_shipping_cents is null or current_shipping_cents >= 0),
  current_checked_at timestamptz,
  unique (merchant_id, url_hash)
);
create index product_offers_product_idx on public.product_offers (product_id) where active;
create index product_offers_due_idx on public.product_offers (last_checked_at nulls first) where active;

-- ————————————————————————— Prix vérifiés (une ligne par vérification réussie, jamais modifiée) —————————————————————————
create table public.offer_observations (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.product_offers (id) on delete cascade,
  checked_at timestamptz not null,
  price_cents bigint not null check (price_cents > 0 and price_cents < 1000000000),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  availability text not null check (availability in ('in_stock', 'out_of_stock', 'preorder', 'limited', 'unknown')),
  shipping_kind text not null check (shipping_kind in ('free', 'known', 'unknown', 'unavailable')),
  shipping_cents bigint check (shipping_cents is null or shipping_cents >= 0),
  condition text not null default 'unknown' check (condition in ('new', 'refurbished', 'used', 'unknown')),
  -- Provenance : d'où vient le prix, comment la fiche a été lue.
  price_source text not null check (price_source in ('jsonld', 'microdata', 'meta', 'html_text')),
  data_fingerprint text not null check (data_fingerprint ~ '^[0-9a-f]{64}$'),
  http_status smallint check (http_status is null or http_status between 100 and 599),
  warnings text[] not null default '{}' check (cardinality(warnings) <= 20),
  from_cache boolean not null default false,
  recorded_at timestamptz not null default now(),
  constraint offer_observations_shipping_consistent check ((shipping_kind = 'known') = (shipping_cents is not null)),
  unique (offer_id, checked_at)
);
create index offer_observations_offer_time_idx on public.offer_observations (offer_id, checked_at desc);

-- ————————————————————————— Historique des variations (alimenté par déclencheur) —————————————————————————
create table public.offer_changes (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.product_offers (id) on delete cascade,
  changed_at timestamptz not null,
  kind text not null check (kind in ('first_seen', 'price', 'availability', 'shipping', 'condition', 'currency')),
  old_value jsonb,
  new_value jsonb,
  currency char(3),
  price_delta_cents bigint,
  price_delta_pct numeric(8, 2)
);
create index offer_changes_offer_time_idx on public.offer_changes (offer_id, changed_at desc);

-- ————————————————————————— Échecs de vérification (métadonnées techniques, conservation courte) —————————————————————————
create table public.verification_failures (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.product_offers (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  reason text not null check (length(reason) between 1 and 60),
  transient boolean not null,
  http_status smallint check (http_status is null or http_status between 100 and 599),
  detail text check (detail is null or length(detail) <= 200)
);
create index verification_failures_offer_time_idx on public.verification_failures (offer_id, occurred_at desc);

-- ————————————————————————— Politique de source : fail-closed —————————————————————————
create function public.catalog_assert_source_allowed(p_source text) returns void
language plpgsql stable as $$
begin
  if not exists (select 1 from public.source_policies where source = p_source and storage_allowed) then
    raise exception 'catalog_storage_not_authorized: la source % n''est pas autorisée dans source_policies', p_source using errcode = 'P0001';
  end if;
end $$;

-- Toute offre suppose des données lues sur une fiche marchande ; une adresse découverte par Brave exige en plus le droit Brave.
create function public.enforce_offer_policy() returns trigger
language plpgsql as $$
begin
  -- Purger une adresse (url -> NULL) est toujours permis : c'est la suppression d'une donnée, pas un stockage.
  if tg_op = 'UPDATE' and new.url is null and old.url is not null and new.url_hash = old.url_hash
     and new.product_id = old.product_id and new.merchant_id = old.merchant_id then
    return new;
  end if;
  perform public.catalog_assert_source_allowed('merchant_page');
  if new.discovery_origin = 'brave' and new.url is not null then
    perform public.catalog_assert_source_allowed('brave');
  end if;
  if new.discovery_origin = 'user_supplied' then
    perform public.catalog_assert_source_allowed('user_supplied');
  end if;
  if new.discovery_origin = 'import' then
    perform public.catalog_assert_source_allowed('import');
  end if;
  return new;
end $$;
create trigger product_offers_policy before insert or update on public.product_offers
  for each row execute function public.enforce_offer_policy();

create function public.enforce_observation_policy() returns trigger
language plpgsql as $$
begin
  perform public.catalog_assert_source_allowed('merchant_page');
  return new;
end $$;
create trigger offer_observations_policy before insert on public.offer_observations
  for each row execute function public.enforce_observation_policy();

-- Les échecs sont aussi soumis à la politique : pas de journal d'une source non autorisée.
create trigger verification_failures_policy before insert on public.verification_failures
  for each row execute function public.enforce_observation_policy();

-- ————————————————————————— Historique : variations et instantané —————————————————————————
create function public.apply_offer_observation() returns trigger
language plpgsql as $$
declare
  o public.product_offers%rowtype;
  newer boolean;
begin
  select * into o from public.product_offers where id = new.offer_id for update;
  newer := o.current_checked_at is null or new.checked_at >= o.current_checked_at;
  if o.current_checked_at is null then
    insert into public.offer_changes (offer_id, changed_at, kind, new_value, currency)
    values (new.offer_id, new.checked_at, 'first_seen', jsonb_build_object('price_cents', new.price_cents, 'availability', new.availability), new.currency);
  elsif newer then
    if o.current_currency is distinct from new.currency then
      -- Jamais de variation de prix entre deux devises : un changement de devise est consigné à part.
      insert into public.offer_changes (offer_id, changed_at, kind, old_value, new_value, currency)
      values (new.offer_id, new.checked_at, 'currency', to_jsonb(o.current_currency), to_jsonb(new.currency), new.currency);
    elsif o.current_price_cents is distinct from new.price_cents then
      insert into public.offer_changes (offer_id, changed_at, kind, old_value, new_value, currency, price_delta_cents, price_delta_pct)
      values (new.offer_id, new.checked_at, 'price', to_jsonb(o.current_price_cents), to_jsonb(new.price_cents), new.currency,
              new.price_cents - o.current_price_cents,
              round(((new.price_cents - o.current_price_cents)::numeric * 100) / o.current_price_cents, 2));
    end if;
    if o.current_availability is distinct from new.availability then
      insert into public.offer_changes (offer_id, changed_at, kind, old_value, new_value)
      values (new.offer_id, new.checked_at, 'availability', to_jsonb(o.current_availability), to_jsonb(new.availability));
    end if;
    if o.current_shipping_kind is distinct from new.shipping_kind or o.current_shipping_cents is distinct from new.shipping_cents then
      insert into public.offer_changes (offer_id, changed_at, kind, old_value, new_value)
      values (new.offer_id, new.checked_at, 'shipping',
              jsonb_build_object('kind', o.current_shipping_kind, 'cents', o.current_shipping_cents),
              jsonb_build_object('kind', new.shipping_kind, 'cents', new.shipping_cents));
    end if;
    if o.condition is distinct from new.condition and new.condition <> 'unknown' then
      insert into public.offer_changes (offer_id, changed_at, kind, old_value, new_value)
      values (new.offer_id, new.checked_at, 'condition', to_jsonb(o.condition), to_jsonb(new.condition));
    end if;
  end if;
  -- Une observation arrivée en retard (plus ancienne que l'instantané) est conservée mais ne le modifie pas.
  if newer then
    update public.product_offers set
      current_price_cents = new.price_cents, current_currency = new.currency, current_availability = new.availability,
      current_shipping_kind = new.shipping_kind, current_shipping_cents = new.shipping_cents, current_checked_at = new.checked_at,
      condition = case when new.condition = 'unknown' then condition else new.condition end,
      last_checked_at = greatest(coalesce(last_checked_at, new.checked_at), new.checked_at), last_status = 'ok',
      last_failure_reason = null, consecutive_failures = 0, active = true
    where id = new.offer_id;
  end if;
  return new;
end $$;
create trigger offer_observations_apply after insert on public.offer_observations
  for each row execute function public.apply_offer_observation();

create function public.apply_verification_failure() returns trigger
language plpgsql as $$
begin
  update public.product_offers set last_status = 'failed', last_failure_reason = new.reason,
    last_checked_at = greatest(coalesce(last_checked_at, new.occurred_at), new.occurred_at), consecutive_failures = consecutive_failures + 1
  where id = new.offer_id;
  return new;
end $$;
create trigger verification_failures_apply after insert on public.verification_failures
  for each row execute function public.apply_verification_failure();

-- ————————————————————————— Rétention et suppression —————————————————————————
-- Durées par défaut : observations et variations 400 jours (13 mois : comparaison d'une année sur l'autre), échecs 90 jours,
-- offres jamais revérifiées depuis 180 jours supprimées (avec leur historique), identités et marchands orphelins nettoyés.
create function public.catalog_apply_retention(
  p_now timestamptz default now(), p_observation_days integer default 400, p_failure_days integer default 90, p_stale_offer_days integer default 180
) returns table (observations_deleted bigint, changes_deleted bigint, failures_deleted bigint, offers_deleted bigint, identities_deleted bigint, merchants_deleted bigint)
language plpgsql as $$
declare a bigint; b bigint; c bigint; d bigint; e bigint; f bigint;
begin
  with x as (delete from public.offer_observations where checked_at < p_now - make_interval(days => p_observation_days) returning 1) select count(*) into a from x;
  with x as (delete from public.offer_changes where changed_at < p_now - make_interval(days => p_observation_days) returning 1) select count(*) into b from x;
  with x as (delete from public.verification_failures where occurred_at < p_now - make_interval(days => p_failure_days) returning 1) select count(*) into c from x;
  with x as (delete from public.product_offers
             where coalesce(last_checked_at, first_seen_at) < p_now - make_interval(days => p_stale_offer_days) returning 1) select count(*) into d from x;
  with x as (delete from public.product_identities i where not exists (select 1 from public.product_offers o where o.product_id = i.id)
             and i.updated_at < p_now - interval '30 days' returning 1) select count(*) into e from x;
  with x as (delete from public.merchants m where not exists (select 1 from public.product_offers o where o.merchant_id = m.id)
             and m.created_at < p_now - interval '30 days' returning 1) select count(*) into f from x;
  return query select a, b, c, d, e, f;
end $$;

-- Retrait des droits (fin de contrat Brave, §13(c)) : la source est désactivée et les adresses issues de Brave sont effacées.
create function public.catalog_revoke_source(p_source text, p_reason text) returns bigint
language plpgsql as $$
declare n bigint := 0;
begin
  update public.source_policies set storage_allowed = false, notes = left(coalesce(p_reason, 'droits retirés'), 500), updated_at = now() where source = p_source;
  if p_source = 'brave' then
    with x as (update public.product_offers set url = null where discovery_origin = 'brave' and url is not null returning 1) select count(*) into n from x;
  end if;
  return n;
end $$;

-- ————————————————————————— Accès : serveur uniquement —————————————————————————
alter table public.source_policies enable row level security;
alter table public.product_identities enable row level security;
alter table public.merchants enable row level security;
alter table public.product_offers enable row level security;
alter table public.offer_observations enable row level security;
alter table public.offer_changes enable row level security;
alter table public.verification_failures enable row level security;
revoke all on public.source_policies, public.product_identities, public.merchants, public.product_offers,
  public.offer_observations, public.offer_changes, public.verification_failures from app_user;
revoke all on function public.catalog_assert_source_allowed(text), public.catalog_apply_retention(timestamptz, integer, integer, integer),
  public.catalog_revoke_source(text, text) from app_user;
