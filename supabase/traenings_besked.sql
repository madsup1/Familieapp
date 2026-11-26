-- Push-besked til de andre spillere, når nogen logger træning (skridt fra genvejen undtaget).
-- Kalder Edge Function figur-besked (mode "workout") via pg_net, ligesom duel-beskeden.
create or replace function public.notify_workout_posted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.type <> 'steps' then
    perform net.http_post(
      url := 'https://ptpriymspqwuuhycjhch.supabase.co/functions/v1/figur-besked',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select value from public.app_secrets where name = 'cron_secret')
      ),
      body := jsonb_build_object('mode', 'workout', 'workout_id', new.id)
    );
  end if;
  return new;
exception when others then
  -- En fejlende besked må aldrig forhindre, at træningen gemmes
  return new;
end $$;

revoke all on function public.notify_workout_posted() from public, anon, authenticated;

drop trigger if exists workout_posted_push on public.workouts;
create trigger workout_posted_push
  after insert on public.workouts
  for each row execute function public.notify_workout_posted();
