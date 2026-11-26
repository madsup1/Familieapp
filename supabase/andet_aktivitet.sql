-- Ved typen "Andet" skriver man selv, hvad man har lavet (fx "Yoga"). Vises i stedet for "Andet".
alter table public.workouts add column if not exists activity text
  check (activity is null or char_length(activity) between 1 and 40);
