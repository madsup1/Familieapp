-- Skridttæller: dagens skridt fra iPhone Sundhed (via en genvej) giver lidt XP hver dag.
-- Skridt gemmes som et automatisk bekræftet pas af typen 'steps' (ét pr. person pr. dag).
-- De tæller ikke som træningsdag (ugemål/dueller), men holder formen oppe ved mange skridt.

alter table public.workouts add column if not exists steps integer check (steps is null or steps >= 0);
alter table public.workouts drop constraint if exists workouts_type_check;
alter table public.workouts add constraint workouts_type_check
  check (type = any (array['running','walking','cycling','swimming','strength','other','steps']));
create unique index if not exists workouts_steps_one_per_day on public.workouts (user_id, workout_date) where type = 'steps';

alter table public.settings add column if not exists xp_per_1000_steps numeric not null default 2;
alter table public.settings add column if not exists steps_max_xp numeric not null default 20;
alter table public.settings add column if not exists steps_form_min integer not null default 6000;

-- Brugere må ikke selv oprette skridt-pas (de kommer kun fra genvejen via Edge Function)
drop policy if exists "egen træning oprettes som afventer" on public.workouts;
create policy "egen træning oprettes som afventer" on public.workouts for insert
  with check (user_id = auth.uid() and proof_status = 'pending' and confirmed_by is null and type <> 'steps');

-- XP: (skridt / 1000, rundet ned) * sats, højst steps_max_xp. Tæller med i dagens loft.
create or replace function public.calc_workout_xp()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  s public.settings%rowtype;
  raw numeric;
  used numeric;
  awarded numeric;
begin
  if tg_op = 'UPDATE'
     and new.proof_status = old.proof_status and new.type = old.type
     and new.workout_date = old.workout_date
     and new.distance_km is not distinct from old.distance_km
     and new.duration_minutes is not distinct from old.duration_minutes
     and new.steps is not distinct from old.steps then
    new.xp_awarded := old.xp_awarded; new.xp_stamina := old.xp_stamina; new.xp_strength := old.xp_strength;
    return new;
  end if;

  select * into s from public.settings where id = 1;

  if new.type = 'steps' then
    if coalesce(new.steps, 0) <= 0 then raise exception 'Angiv antal skridt'; end if;
    raw := least(floor(new.steps / 1000.0) * s.xp_per_1000_steps, s.steps_max_xp);
  elsif new.type in ('running','walking','cycling') then
    if coalesce(new.distance_km, 0) <= 0 then raise exception 'Angiv en distance i km'; end if;
    raw := new.distance_km * case new.type
      when 'running' then s.xp_per_km_running
      when 'walking' then s.xp_per_km_walking
      else s.xp_per_km_cycling end;
  else
    if coalesce(new.duration_minutes, 0) <= 0 then raise exception 'Angiv varighed i minutter'; end if;
    raw := new.duration_minutes * case new.type
      when 'strength' then s.xp_per_minute_strength
      when 'swimming' then s.xp_per_minute_swimming
      else s.xp_per_minute_other end;
  end if;

  if new.proof_status <> 'confirmed' then
    awarded := 0;
  else
    select coalesce(sum(w.xp_awarded), 0) into used from public.workouts w
      where w.user_id = new.user_id and w.workout_date = new.workout_date and w.id <> new.id;
    awarded := greatest(least(raw, s.daily_xp_cap - used), 0);
  end if;

  new.xp_awarded := round(awarded, 1);
  if new.type = 'strength' then
    new.xp_strength := new.xp_awarded; new.xp_stamina := 0;
  else
    new.xp_stamina := new.xp_awarded; new.xp_strength := 0;
  end if;
  return new;
end $function$;

-- Sidste "aktive" dag til formen: skridt tæller kun ved mange skridt
create or replace function public.player_stats()
 returns table(user_id uuid, total numeric, stamina numeric, strength numeric, last_workout date)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.id,
         coalesce(sum(w.xp_awarded), 0),
         coalesce(sum(w.xp_stamina), 0),
         coalesce(sum(w.xp_strength), 0),
         max(w.workout_date) filter (where w.proof_status <> 'rejected'
           and (w.type <> 'steps' or w.steps >= (select steps_form_min from public.settings where id = 1)))
  from public.profiles p
  left join public.workouts w on w.user_id = p.id
  group by p.id
$function$;

-- Personlig kode til genvejen. Kun et hash gemmes; selve koden vises én gang i appen.
create table if not exists public.step_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.step_tokens enable row level security;

create or replace function public.create_step_token()
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare
  me uuid := auth.uid();
  tok text;
begin
  if me is null then raise exception 'ikke logget ind'; end if;
  tok := upper(encode(extensions.gen_random_bytes(6), 'hex'));  -- 12 tegn, let at taste
  insert into public.step_tokens (user_id, token_hash) values (me, encode(extensions.digest(tok, 'sha256'), 'hex'))
    on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now();
  return tok;
end $$;

create or replace function public.step_token_status()
 returns timestamptz
 language sql
 stable security definer
 set search_path to 'public'
as $$ select created_at from public.step_tokens where user_id = auth.uid() $$;

revoke all on function public.create_step_token() from public, anon;
revoke all on function public.step_token_status() from public, anon;
grant execute on function public.create_step_token() to authenticated;
grant execute on function public.step_token_status() to authenticated;
