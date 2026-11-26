-- Alle pas, man selv logger, skal have et bevisbillede (skridt kommer fra genvejen og er undtaget).
drop policy if exists "egen træning oprettes som afventer" on public.workouts;
create policy "egen træning oprettes som afventer" on public.workouts for insert
  with check (user_id = auth.uid() and proof_status = 'pending' and confirmed_by is null
              and type <> 'steps' and proof_path is not null);
