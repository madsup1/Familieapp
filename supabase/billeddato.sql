-- Billedets optagelsesdato (læst fra billedets EXIF i appen, lokal tid) gemmes med passet.
-- Et billede taget en anden dag end passet afvises, så man ikke kan genbruge billeder fra én tur i fitness.
alter table public.workouts add column if not exists photo_taken_at timestamp;

create or replace function public.check_photo_date()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.photo_taken_at is not null and new.photo_taken_at::date <> new.workout_date then
    raise exception 'Billedet er taget %, men træningen er logget %. Vælg et billede fra samme dag.',
      to_char(new.photo_taken_at, 'DD.MM.YYYY'), to_char(new.workout_date, 'DD.MM.YYYY') using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists workouts_photo_date on public.workouts;
create trigger workouts_photo_date
  before insert or update of photo_taken_at, workout_date on public.workouts
  for each row execute function public.check_photo_date();
