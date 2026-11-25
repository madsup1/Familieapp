-- HISTORISK: databasen er siden ændret direkte i Supabase. Se CLAUDE.md og læs live-definitioner.
-- TrænDyst: database-opsætning til Supabase.
-- Kør hele filen i Supabase > SQL Editor.

-- ---------- Tabeller ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  xp_per_km_running numeric not null default 10,
  xp_per_minute_strength numeric not null default 1,
  xp_per_minute_other numeric not null default 0.5,
  daily_xp_cap numeric not null default 200,
  level_curve_base numeric not null default 100,
  level_curve_exponent numeric not null default 1.5,
  stage2_level int not null default 5,
  stage3_level int not null default 10,
  stage4_level int not null default 20,
  stage5_level int not null default 35,
  duel_duration_days int not null default 7,
  max_active_duels int not null default 1
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.characters (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  appearance jsonb not null default '{}'::jsonb
);

create table if not exists public.items (
  id text primary key,
  name text not null,
  slot text not null check (slot in ('background','body','shoes','top','headband','armband','hat')),
  unlock_type text not null check (unlock_type in ('stamina_xp','strength_xp','level')),
  unlock_value numeric not null default 1,
  stage_required int not null default 1,
  sprite_url text,
  color text not null default '#0066FF'
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('running','strength','other')),
  workout_date date not null default current_date,
  duration_minutes numeric not null check (duration_minutes > 0),
  distance_km numeric,
  muscle_group text,
  xp_awarded numeric not null default 0,
  xp_stamina numeric not null default 0,
  xp_strength numeric not null default 0,
  proof_path text,
  proof_status text not null default 'pending' check (proof_status in ('pending','confirmed','rejected')),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id),
  opponent_id uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','active','finished','declined')),
  start_at timestamptz,
  end_at timestamptz,
  challenger_xp numeric not null default 0,
  opponent_xp numeric not null default 0,
  winner_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);

-- ---------- Hjælpefunktioner ----------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

-- ---------- Spillere: maks. to, og de oprettes ved registrering ----------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.profiles) >= 2 then
    raise exception 'TrænDyst er fuld: der må kun være to spillere';
  end if;
  insert into public.profiles (id, name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    (select count(*) = 0 from public.profiles)
  );
  insert into public.characters (user_id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- XP beregnes i databasen, så appen ikke kan snydes ----------

create or replace function public.calc_workout_xp() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.settings%rowtype;
  raw numeric;
  used numeric;
  awarded numeric;
begin
  select * into s from public.settings where id = 1;

  if new.type = 'running' then
    raw := coalesce(new.distance_km, 0) * s.xp_per_km_running;
  elsif new.type = 'strength' then
    raw := new.duration_minutes * s.xp_per_minute_strength;
  else
    raw := new.duration_minutes * s.xp_per_minute_other;
  end if;

  -- Styrke tæller først, når den anden forælder har bekræftet passet.
  if new.type = 'strength' and new.proof_status <> 'confirmed' then
    awarded := 0;
  else
    select coalesce(sum(w.xp_awarded), 0) into used
      from public.workouts w
      where w.user_id = new.user_id
        and w.workout_date = new.workout_date
        and w.id <> new.id;
    awarded := greatest(least(raw, s.daily_xp_cap - used), 0);
  end if;

  new.xp_awarded := round(awarded, 1);
  if new.type = 'strength' then
    new.xp_strength := new.xp_awarded;
    new.xp_stamina := 0;
  else
    new.xp_stamina := new.xp_awarded;
    new.xp_strength := 0;
  end if;
  return new;
end $$;

drop trigger if exists workouts_xp on public.workouts;
create trigger workouts_xp
  before insert or update on public.workouts
  for each row execute function public.calc_workout_xp();

-- ---------- Bekræftelse af styrketræning (kun den anden spiller) ----------

create or replace function public.confirm_workout(p_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
declare w public.workouts%rowtype;
begin
  if p_decision not in ('confirmed', 'rejected') then
    raise exception 'ugyldig beslutning';
  end if;
  select * into w from public.workouts where id = p_id;
  if not found then raise exception 'træningen findes ikke'; end if;
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'du skal være logget ind';
  end if;
  if w.user_id = auth.uid() then
    raise exception 'du kan ikke bekræfte din egen træning';
  end if;
  update public.workouts
    set proof_status = p_decision, confirmed_by = auth.uid(), confirmed_at = now()
    where id = p_id;
end $$;

-- ---------- Dueller ----------

create or replace function public.challenge_player(p_opponent uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null or me = p_opponent then raise exception 'ugyldig modstander'; end if;
  if not exists (select 1 from public.profiles where id = p_opponent) then
    raise exception 'ukendt modstander';
  end if;
  if (select count(*) from public.duels where status = 'active')
     >= (select max_active_duels from public.settings where id = 1) then
    raise exception 'der er allerede en aktiv duel';
  end if;
  insert into public.duels (challenger_id, opponent_id, status)
    values (me, p_opponent, 'pending')
    returning id into new_id;
  return new_id;
end $$;

create or replace function public.accept_duel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.duels%rowtype;
  s public.settings%rowtype;
begin
  select * into d from public.duels where id = p_id;
  if not found or d.status <> 'pending' or d.opponent_id <> auth.uid() then
    raise exception 'duellen kan ikke accepteres';
  end if;
  select * into s from public.settings where id = 1;
  if (select count(*) from public.duels where status = 'active') >= s.max_active_duels then
    raise exception 'der er allerede en aktiv duel';
  end if;
  update public.duels
    set status = 'active', start_at = now(),
        end_at = now() + make_interval(days => s.duel_duration_days)
    where id = p_id;
end $$;

create or replace function public.decline_duel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.duels set status = 'declined'
    where id = p_id and status = 'pending' and opponent_id = auth.uid();
end $$;

create or replace function public.settle_duel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.duels%rowtype;
  cx numeric;
  ox numeric;
begin
  select * into d from public.duels where id = p_id;
  if not found or d.status <> 'active' or now() < d.end_at then return; end if;
  if auth.uid() not in (d.challenger_id, d.opponent_id) then
    raise exception 'du er ikke med i denne duel';
  end if;
  select coalesce(sum(xp_awarded), 0) into cx from public.workouts
    where user_id = d.challenger_id and created_at >= d.start_at and created_at < d.end_at;
  select coalesce(sum(xp_awarded), 0) into ox from public.workouts
    where user_id = d.opponent_id and created_at >= d.start_at and created_at < d.end_at;
  update public.duels
    set status = 'finished', challenger_xp = cx, opponent_xp = ox,
        winner_id = case when cx > ox then d.challenger_id
                         when ox > cx then d.opponent_id
                         else null end
    where id = p_id;
end $$;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.characters enable row level security;
alter table public.items enable row level security;
alter table public.workouts enable row level security;
alter table public.duels enable row level security;

create policy "profiler læses af alle" on public.profiles
  for select to authenticated using (true);
create policy "eget navn kan opdateres" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_admin = public.is_admin());

create policy "indstillinger læses" on public.settings
  for select to authenticated using (true);
create policy "kun admin ændrer indstillinger" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "figurer læses af alle" on public.characters
  for select to authenticated using (true);
create policy "egen figur kan ændres" on public.characters
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "katalog læses" on public.items
  for select to authenticated using (true);
create policy "admin redigerer katalog" on public.items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "træninger læses af alle" on public.workouts
  for select to authenticated using (true);
create policy "egen træning oprettes som afventer" on public.workouts
  for insert to authenticated
  with check (user_id = auth.uid() and proof_status = 'pending' and confirmed_by is null);
create policy "egen træning kan slettes" on public.workouts
  for delete to authenticated using (user_id = auth.uid());

create policy "dueller læses af alle" on public.duels
  for select to authenticated using (true);
-- Duel-ændringer går kun via funktionerne ovenfor.

-- ---------- Bevis-billeder (privat bucket) ----------

insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

create policy "bevis: upload til egen mappe" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "bevis: begge spillere kan se" on storage.objects
  for select to authenticated
  using (bucket_id = 'proofs');

-- ---------- Startkatalog (kan ændres i Table Editor) ----------

insert into public.items (id, name, slot, unlock_type, unlock_value, stage_required, color) values
  ('body_base',        'Basiskrop',         'body',       'level',        1,   1, '#f4a261'),
  ('bg_park',          'Park',              'background', 'level',        1,   1, '#b7e4c7'),
  ('bg_gym',           'Træningscenter',    'background', 'level',        20,  4, '#495057'),
  ('bg_sunset',        'Solnedgang',        'background', 'level',        35,  5, '#ff8fab'),
  ('top_tshirt',       'T-shirt',           'top',        'level',        1,   1, '#4f8cff'),
  ('top_sport',        'Sportstrøje',       'top',        'stamina_xp',   300, 2, '#ff9f1c'),
  ('top_hoodie',       'Hættetrøje',        'top',        'level',        20,  4, '#2d3142'),
  ('shoes_runners',    'Løbesko',           'shoes',      'stamina_xp',   500, 3, '#e63946'),
  ('shoes_boots',      'Støvler',           'shoes',      'strength_xp',  800, 4, '#6d4c41'),
  ('headband_sweat',   'Svedbånd',          'headband',   'stamina_xp',   150, 2, '#ffffff'),
  ('headband_pro',     'Pandebånd',         'headband',   'level',        20,  4, '#00b4d8'),
  ('armband_strength', 'Styrkearmbånd',     'armband',    'strength_xp',  300, 3, '#8338ec'),
  ('armband_gold',     'Guldarmbånd',       'armband',    'level',        35,  5, '#ffd60a'),
  ('hat_cap',          'Kasket',            'hat',        'level',        5,   2, '#264653'),
  ('hat_crown',        'Krone',             'hat',        'level',        35,  5, '#ffd60a')
on conflict (id) do nothing;
