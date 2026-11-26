-- Flere ting at låse op: to nye pladser (briller og hals) og nyt udstyr i de eksisterende.
-- Figuren tegnes i src/voxel.js ud fra id'et.
alter table public.items drop constraint if exists items_slot_check;
alter table public.items add constraint items_slot_check
  check (slot = any (array['background','body','shoes','top','headband','armband','hat','glasses','neck']));

insert into public.items (id, name, slot, unlock_type, unlock_value, stage_required, color) values
  ('bg_strand', 'Strand', 'background', 'level', '3', 1, '#fde7a8'),
  ('bg_fitness', 'Fitnesscenter', 'background', 'strength_xp', '300', 1, '#e7e2da'),
  ('bg_svoemmehal', 'Svømmehal', 'background', 'stamina_xp', '600', 1, '#bfe6f5'),
  ('bg_vinter', 'Vinterland', 'background', 'level', '15', 1, '#e8f1f8'),
  ('bg_rummet', 'Rummet', 'background', 'level', '45', 1, '#0b1026'),
  ('top_haette', 'Hættetrøje', 'top', 'level', '12', 1, '#6b7280'),
  ('top_stribet', 'Stribet trøje', 'top', 'level', '16', 1, '#0e9f6e'),
  ('top_super', 'Supertrøje', 'top', 'level', '30', 1, '#dc2626'),
  ('shoes_neon', 'Neonsko', 'shoes', 'level', '15', 1, '#22d3ee'),
  ('shoes_vandre', 'Vandrestøvler', 'shoes', 'stamina_xp', '1200', 1, '#8b5a2b'),
  ('shoes_guld', 'Guldsko', 'shoes', 'level', '40', 1, '#d4a017'),
  ('hat_propel', 'Propelhue', 'hat', 'level', '2', 1, '#e8553d'),
  ('hat_cowboy', 'Cowboyhat', 'hat', 'level', '14', 1, '#8b5a2b'),
  ('hat_hjelm', 'Cykelhjelm', 'hat', 'stamina_xp', '1500', 1, '#2f66f3'),
  ('hat_viking', 'Vikinghjelm', 'hat', 'strength_xp', '2000', 1, '#9ca3af'),
  ('hb_regnbue', 'Regnbuebånd', 'headband', 'level', '18', 1, '#a855f7'),
  ('hb_ninja', 'Ninjabånd', 'headband', 'strength_xp', '1200', 1, '#15161a'),
  ('gl_runde', 'Briller', 'glasses', 'level', '2', 1, '#15161a'),
  ('gl_sol', 'Solbriller', 'glasses', 'level', '9', 1, '#15161a'),
  ('gl_ski', 'Skibriller', 'glasses', 'stamina_xp', '1000', 1, '#f97316'),
  ('gl_stjerne', 'Stjernebriller', 'glasses', 'level', '22', 1, '#ec4899'),
  ('nk_floejte', 'Trænerfløjte', 'neck', 'level', '3', 1, '#e5e7eb'),
  ('nk_toerklaede', 'Halstørklæde', 'neck', 'level', '11', 1, '#dc2626'),
  ('nk_medalje', 'Guldmedalje', 'neck', 'level', '25', 1, '#d4a017'),
  ('nk_kaede', 'Guldkæde', 'neck', 'strength_xp', '2500', 1, '#facc15'),
  ('arm_ur', 'Sportsur', 'armband', 'level', '7', 1, '#15161a'),
  ('arm_guld', 'Guldarmbånd', 'armband', 'level', '28', 1, '#d4a017')
on conflict (id) do update set name = excluded.name, slot = excluded.slot, unlock_type = excluded.unlock_type,
  unlock_value = excluded.unlock_value, stage_required = excluded.stage_required, color = excluded.color;
