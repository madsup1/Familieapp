-- Push-besked med det samme, når nogen udfordrer en til duel.
-- Kalder Edge Function figur-besked (mode "duel") via pg_net, ligesom cron-opgaverne gør.
create or replace function public.notify_duel_challenge()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'pending' then
    perform net.http_post(
      url := 'https://ptpriymspqwuuhycjhch.supabase.co/functions/v1/figur-besked',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select value from public.app_secrets where name = 'cron_secret')
      ),
      body := jsonb_build_object('mode', 'duel', 'duel_id', new.id)
    );
  end if;
  return new;
exception when others then
  -- En fejlende besked må aldrig forhindre selve udfordringen
  return new;
end $$;

revoke all on function public.notify_duel_challenge() from public, anon, authenticated;

drop trigger if exists duel_challenge_push on public.duels;
create trigger duel_challenge_push
  after insert on public.duels
  for each row execute function public.notify_duel_challenge();
