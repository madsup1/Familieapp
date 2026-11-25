-- Motionsligaen: design-opdatering. Kør efter schema.sql.

-- Varighed er valgfri for løb.
alter table public.workouts alter column duration_minutes drop not null;
alter table public.workouts drop constraint if exists workouts_duration_minutes_check;
alter table public.workouts add constraint workouts_duration_minutes_check
  check (duration_minutes is null or duration_minutes > 0);

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
    if coalesce(new.distance_km, 0) <= 0 then raise exception 'Løb kræver en distance'; end if;
    raw := new.distance_km * s.xp_per_km_running;
  else
    if coalesce(new.duration_minutes, 0) <= 0 then raise exception 'Angiv varighed i minutter'; end if;
    if new.type = 'strength' then
      raw := new.duration_minutes * s.xp_per_minute_strength;
    else
      raw := new.duration_minutes * s.xp_per_minute_other;
    end if;
  end if;

  if new.type = 'strength' and new.proof_status <> 'confirmed' then
    awarded := 0;
  else
    select coalesce(sum(w.xp_awarded), 0) into used
      from public.workouts w
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
end $$;

-- Startudstyr til nye figurer.
alter table public.characters alter column appearance
  set default '{"background":"bg_skovsti","body":"body_1","shoes":"shoes_gamle","top":"top_traening"}'::jsonb;
update public.characters
  set appearance = '{"background":"bg_skovsti","body":"body_1","shoes":"shoes_gamle","top":"top_traening"}'::jsonb
  where appearance = '{}'::jsonb;

-- Katalog som i Motionsligaen.
delete from public.items;
insert into public.items (id, name, slot, unlock_type, unlock_value, stage_required, color) values
  ('bg_skovsti',   'Skovsti',          'background', 'level',       1,   1, '#dcefe2'),
  ('bg_stadion',   'Stadion',          'background', 'level',       5,   1, '#f6d77a'),
  ('bg_bjergtop',  'Bjergtop',         'background', 'level',       10,  1, '#b9d6f2'),
  ('bg_natby',     'Natby',            'background', 'level',       20,  1, '#2b2d5c'),
  ('bg_ildhav',    'Ildhav',           'background', 'level',       35,  1, '#f08a5d'),
  ('body_1',       'Krop Trin 1',      'body',       'level',       1,   1, '#e0b48e'),
  ('body_2',       'Krop Trin 2',      'body',       'level',       5,   2, '#e0b48e'),
  ('body_3',       'Krop Trin 3',      'body',       'level',       10,  3, '#e0b48e'),
  ('body_4',       'Krop Trin 4',      'body',       'level',       20,  4, '#e0b48e'),
  ('body_5',       'Krop Trin 5',      'body',       'level',       35,  5, '#e0b48e'),
  ('shoes_gamle',  'Gamle sko',        'shoes',      'level',       1,   1, '#4b5563'),
  ('shoes_lyn',    'Lynsko',           'shoes',      'level',       10,  1, '#facc15'),
  ('shoes_vaegt',  'Vægtløftersko',    'shoes',      'strength_xp', 200, 1, '#7c2d12'),
  ('shoes_loeb',   'Løbesko',          'shoes',      'stamina_xp',  200, 1, '#ef4444'),
  ('top_traening', 'Træningstrøje',    'top',        'level',       1,   1, '#2f66f3'),
  ('top_mester',   'Mesterskabstrøje', 'top',        'level',       20,  1, '#f5c518'),
  ('top_loebetop', 'Løbetop',          'top',        'stamina_xp',  500, 1, '#22c55e'),
  ('top_styrke',   'Styrketrøje',      'top',        'strength_xp', 500, 1, '#e8553d'),
  ('hb_sved',      'Svedbånd',         'headband',   'level',       3,   1, '#f8fafc'),
  ('hb_pande',     'Pandebånd',        'headband',   'stamina_xp',  800, 1, '#06b6d4'),
  ('arm_basis',    'Armbånd',          'armband',    'level',       4,   1, '#9ca3af'),
  ('arm_jern',     'Jernarmbånd',      'armband',    'strength_xp', 800, 1, '#374151'),
  ('hat_kasket',   'Kasket',           'hat',        'level',       6,   1, '#1f2937'),
  ('hat_hue',      'Hue',              'hat',        'level',       8,   1, '#dc2626'),
  ('hat_krone',    'Krone',            'hat',        'level',       35,  1, '#facc15');
