-- Biorythme — schéma de réservation des cours.
-- Idempotent : exécuté à chaque build Vercel par scripts/migrate.mjs.

create extension if not exists pgcrypto;

-- Studios / salles de chaque club
create table if not exists bio_rooms (
  id uuid primary key default gen_random_uuid(),
  club text not null check (club in ('six-fours', 'sanary')),
  name text not null,
  capacity int not null default 20 check (capacity > 0),
  color text not null default '#d7ff3a',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists bio_coaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null default '',
  created_at timestamptz not null default now()
);

-- Types de cours (Pilates, Pump, RPM…)
create table if not exists bio_courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  intensity int not null default 2 check (intensity between 1 and 3),
  duration_min int not null default 45 check (duration_min > 0),
  color text not null default '#d7ff3a',
  created_at timestamptz not null default now()
);

-- Séances planifiées
create table if not exists bio_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references bio_courses(id) on delete cascade,
  room_id uuid not null references bio_rooms(id) on delete cascade,
  coach_id uuid references bio_coaches(id) on delete set null,
  starts_at timestamptz not null,
  duration_min int not null default 45 check (duration_min > 0),
  capacity int not null check (capacity > 0),
  booked_count int not null default 0 check (booked_count >= 0),
  published boolean not null default true,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint bio_sessions_not_overbooked check (booked_count <= capacity)
);
create index if not exists bio_sessions_starts_at_idx on bio_sessions (starts_at);

create table if not exists bio_bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references bio_sessions(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null default '',
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  cancel_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create unique index if not exists bio_bookings_one_per_email
  on bio_bookings (session_id, lower(email)) where status = 'confirmed';
create index if not exists bio_bookings_session_idx on bio_bookings (session_id);

-- RLS : le public lit le planning, n'accède jamais aux réservations.
alter table bio_rooms enable row level security;
alter table bio_coaches enable row level security;
alter table bio_courses enable row level security;
alter table bio_sessions enable row level security;
alter table bio_bookings enable row level security;

drop policy if exists bio_rooms_read on bio_rooms;
create policy bio_rooms_read on bio_rooms for select using (true);
drop policy if exists bio_coaches_read on bio_coaches;
create policy bio_coaches_read on bio_coaches for select using (true);
drop policy if exists bio_courses_read on bio_courses;
create policy bio_courses_read on bio_courses for select using (true);
drop policy if exists bio_sessions_read on bio_sessions;
create policy bio_sessions_read on bio_sessions for select using (published);

-- Réservation atomique : verrou sur la séance, pas de surbooking possible.
create or replace function bio_book(p_session uuid, p_name text, p_email text, p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s bio_sessions%rowtype;
  token uuid;
begin
  if coalesce(trim(p_name), '') = '' or position('@' in coalesce(p_email, '')) = 0 then
    raise exception 'INVALID_INPUT';
  end if;

  select * into s from bio_sessions where id = p_session for update;
  if not found or not s.published then raise exception 'NOT_FOUND'; end if;
  if s.cancelled then raise exception 'CANCELLED'; end if;
  if s.starts_at <= now() then raise exception 'PAST'; end if;
  if s.booked_count >= s.capacity then raise exception 'FULL'; end if;

  begin
    insert into bio_bookings (session_id, name, email, phone)
    values (p_session, trim(p_name), lower(trim(p_email)), coalesce(trim(p_phone), ''))
    returning cancel_token into token;
  exception when unique_violation then
    raise exception 'ALREADY_BOOKED';
  end;

  update bio_sessions set booked_count = booked_count + 1 where id = p_session;
  return token;
end;
$$;

create or replace function bio_cancel(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  b bio_bookings%rowtype;
begin
  select * into b from bio_bookings where cancel_token = p_token and status = 'confirmed' for update;
  if not found then return false; end if;
  update bio_bookings set status = 'cancelled' where id = b.id;
  update bio_sessions set booked_count = greatest(booked_count - 1, 0) where id = b.session_id;
  return true;
end;
$$;

revoke all on function bio_book(uuid, text, text, text) from public;
revoke all on function bio_cancel(uuid) from public;
grant execute on function bio_book(uuid, text, text, text) to anon, authenticated;
grant execute on function bio_cancel(uuid) to anon, authenticated;

-- Temps réel : diffusion des changements de places.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'bio_sessions'
     ) then
    alter publication supabase_realtime add table bio_sessions;
  end if;
end $$;

-- Données de départ (uniquement si la base est vide).
do $$
begin
  if not exists (select 1 from bio_rooms) then
    insert into bio_rooms (club, name, capacity, color, position) values
      ('six-fours', 'Studio Bike', 30, '#ff4d2e', 1),
      ('six-fours', 'Studio Pump & Boxe', 35, '#d7ff3a', 2),
      ('six-fours', 'Studio Zen & Freestyle', 25, '#7cf5ff', 3),
      ('sanary', 'Salle de cours', 20, '#d7ff3a', 1);
  end if;
  if not exists (select 1 from bio_courses) then
    insert into bio_courses (name, description, intensity, duration_min, color) values
      ('RPM', 'Vélo indoor en musique, cardio à fond.', 3, 45, '#ff4d2e'),
      ('Body Pump', 'Renforcement musculaire avec barres et poids.', 3, 55, '#d7ff3a'),
      ('Boxe Fit', 'Enchaînements de boxe pour se dépenser.', 3, 45, '#ff4d2e'),
      ('Cuisses Abdos Fessiers', 'Travail ciblé du bas du corps et de la sangle.', 2, 45, '#d7ff3a'),
      ('Pilates', 'Gainage profond, posture et respiration.', 1, 45, '#7cf5ff'),
      ('Yoga', 'Souplesse, équilibre et relâchement.', 1, 60, '#7cf5ff'),
      ('Stretching', 'Étirements et récupération.', 1, 30, '#7cf5ff');
  end if;
end $$;

-- Planning de démonstration sur 14 jours (uniquement si aucune séance n'existe).
do $$
declare
  d int;
  slot record;
begin
  if exists (select 1 from bio_sessions) then return; end if;
  for d in 0..13 loop
    if extract(isodow from (current_date + d)) = 7 then continue; end if;
    for slot in
      select * from (values
        ('six-fours', 'Studio Bike', 'RPM', '09:15'),
        ('six-fours', 'Studio Pump & Boxe', 'Body Pump', '12:15'),
        ('six-fours', 'Studio Zen & Freestyle', 'Pilates', '10:30'),
        ('six-fours', 'Studio Pump & Boxe', 'Boxe Fit', '18:30'),
        ('six-fours', 'Studio Bike', 'RPM', '19:15'),
        ('six-fours', 'Studio Zen & Freestyle', 'Yoga', '18:00'),
        ('sanary', 'Salle de cours', 'Cuisses Abdos Fessiers', '09:30'),
        ('sanary', 'Salle de cours', 'Stretching', '12:30'),
        ('sanary', 'Salle de cours', 'Body Pump', '18:30')
      ) as t(club, room, course, hhmm)
    loop
      -- samedi : matin seulement
      if extract(isodow from (current_date + d)) = 6 and slot.hhmm > '12:00' then continue; end if;
      insert into bio_sessions (course_id, room_id, starts_at, duration_min, capacity)
      select c.id, r.id,
             ((current_date + d)::text || ' ' || slot.hhmm)::timestamp at time zone 'Europe/Paris',
             c.duration_min, r.capacity
      from bio_courses c, bio_rooms r
      where c.name = slot.course and r.name = slot.room and r.club = slot.club
      limit 1;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
