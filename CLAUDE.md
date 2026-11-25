# Motionsligaen — kontekst for Claude

Træningsapp for en familie (op til 5 personer): man logger træning, optjener XP, har en 3D-figur i pixel/voxel-stil
der udvikler sig med træningen, og dyster mod hinanden. Ejer: Mads (madsup1). Brugerne er hans forældre og familie,
så **UI-tekst er på dansk**, store knapper, høj kontrast og så lidt friktion som muligt. Det vigtigste er, at familien
faktisk bruger appen — venlighed over for den, der halter bagefter, er vigtigere end ren konkurrence.

## Udgivelse
- Kode: GitHub `madsup1/Familieapp`, gren `main`.
- Netlify-projekt `mellifluous-trifle-e08302` er forbundet til repoet. **Hvert push til `main` bygger og udgiver automatisk**
  (`netlify.toml`: `npm run build`, mappe `dist`, Node 20, Supabase-URL og publishable key som build-miljø).
- Live: https://mellifluous-trifle-e08302.netlify.app — linket er givet til familien. **Omdøb ikke projektet.**
- Supabase Auth Site URL skal pege på linket ovenfor.

## Stak
- React 18 + Vite (ren JS, ingen TypeScript), `lucide-react` ikoner, `three` til figuren.
- Supabase (projekt `ptpriymspqwuuhycjhch`, eu-central-1): Postgres, Auth (e-mail/kodeord), Storage, Edge Functions, pg_cron, pg_net.
- PWA til iPhone ("Føj til hjemmeskærm"); `public/sw.js` er service worker til push-beskeder.

## Filer
- `src/App.jsx` — login-flow, dataindlæsning (kun de seneste `settings.history_days`, standard 60 dage), navigation.
- `src/Home.jsx` — Oversigt: ugemål, bekræftelser med high-five, dueller, stilling, feed, ugegraf, hurtig log.
- `src/Log.jsx` — log træning (6 typer), billede, dagens XP, seneste ture. Eksporterer `TYPE_ICONS`.
- `src/Character.jsx` — figur (navn, form, beskeder, udstyr). `src/Figure.jsx` + `src/voxel.js` — 3D-figuren.
- `src/Cheers.jsx` — high-fives/kommentarer. `src/Photo.jsx` — billeder (signerede URL'er, nedskalering før upload).
- `src/Settings.jsx` — kun admin: invitationer og balance. `src/notify.js` — push-tilmelding.
- `src/game.js` — **delte spilregler på klienten** (niveau, trin, form, ugemål, XP-forhåndsvisning). Skal matche databasen.
- `preview/mockSupabase.js` + `vite.preview.config.js` — preview-build med falsk database i hukommelsen
  (`npx vite build --config vite.preview.config.js` → `preview-dist/`). Opdatér mocken, når reglerne ændres.
- `supabase/functions/figur-besked/index.ts` — Edge Function (beskeder + oprydning).
- `supabase/*.sql` — **historiske**; databasen er ændret direkte siden. Se "Database" og læs live-definitioner før ændringer.

## Regler (håndhæves i databasen — klienten viser kun)
- **XP** beregnes af triggeren `calc_workout_xp`: løb/gåtur/cykling pr. km, styrke/svømning/andet pr. minut (satser i `settings`).
  Dagligt loft `daily_xp_cap`. XP genberegnes kun, når status, type, dato, distance eller varighed ændres
  (så gamle pas aldrig skifter værdi, hvis satserne ændres).
- **Alle pas skal bekræftes** af en anden spiller (`confirm_workout`; man kan ikke bekræfte egne). Afventende pas giver 0 XP.
  Efter 3 dage bekræftes de automatisk (`auto_confirm_and_settle`, én ad gangen så loftet regnes rigtigt). Afviste forbliver afviste.
- **Styrke kræver billede**; øvrige typer har valgfrit billede (fx Strava-skærmbillede). Bucket `proofs` (privat), sti `<user_id>/<workout_id>.<ext>`.
- **Ugemål** = træningsdage pr. uge (1–7). En dag tæller ved ét ikke-afvist pas på ≥15 min eller ≥2 km (`training_days`).
  Ændres via `set_weekly_goal`: første gang med det samme, ellers fra næste mandag (`pending_goal`/`pending_from`).
  `profiles` har kolonne-rettigheder: brugere må kun opdatere `name` direkte.
- **Stilling og dueller** måles i procent af eget ugemål. Duel = 7 dage, mål låses ved accept, vinder = højeste procent, uafgjort → XP.
  En duel afgøres først, når ingen pas fra perioden afventer (`settle_duel_core`). Max én aktiv duel pr. spiller.
- **Form** (kun klient, `game.js` + Edge Function): dage siden sidste ikke-afviste pas → 0–1 Topform, 2–3 Lidt sløv,
  4–6 Ude af form, 7+ Sofakartoffel. Én træning giver straks topform igen (også mens passet afventer). XP/niveau tabes aldrig.
- **Samlet XP** for alle tider kommer fra `player_stats()` (serveren), da klienten kun henter ~2 måneder.
- **Skridt** (type `steps`): kommer fra iPhone Sundhed via genvejen "Motionsligaen skridt" (se `GENVEJ-SKRIDT.md`)
  → Edge Function `skridt` med personlig kode (`step_tokens`, kun hash; `create_step_token()`). Ét automatisk bekræftet
  pas pr. person pr. dag (unik index), `xp_per_1000_steps` (2) op til `steps_max_xp` (20), tæller i dagsloftet.
  Ikke træningsdag; holder kun formen ved ≥ `steps_form_min` (6000). Brugere kan ikke selv indsætte `steps`-pas (RLS).
- **Billeddato**: `workouts.photo_taken_at` læses fra EXIF i appen; trigger `check_photo_date` afviser billeder fra en anden dag.
- **Spillere**: max `settings.max_players` (5). Kun e-mails i `allowed_emails` kan oprette konto. Første konto er admin.
- **Historik**: billeder og beskeder ældre end `history_days` slettes hver nat; pas og XP bevares.

## Database (public-skema)
Tabeller: `profiles`, `settings` (én række, id=1), `characters` (appearance jsonb, name), `items` (udstyrskatalog),
`workouts`, `duels`, `cheers` (pk workout_id+user_id), `allowed_emails`, `push_subscriptions`, `notification_log`,
`app_secrets` (RLS uden politikker = kun service role; indeholder VAPID-nøgler og cron-hemmelighed — **læs eller vis aldrig værdierne**).
RPC'er: `confirm_workout`, `challenge_player`, `accept_duel`, `decline_duel`, `settle_duel`, `set_weekly_goal`,
`player_stats`, `touch_seen`, `get_vapid_public`. Interne: `settle_duel_core`, `auto_confirm_and_settle`, `training_days`,
`effective_goal`, `handle_new_user` (trigger på auth.users), `calc_workout_xp` (trigger), `is_admin`, `dk_today`.

Læs en live-definition før du ændrer den, fx `select pg_get_functiondef('public.calc_workout_xp'::regproc);`.
Brug migrationer til DDL, og test regler med en `do $$ ... raise exception 'TEST ...' $$` blok, så intet bliver gemt.

Planlagte opgaver (pg_cron, UTC): `figur-besked-dagligt` 16:30 (beskeder), `auto-bekraeft-hver-time` :07,
`oprydning-hver-nat` 03:15. Cron kalder Edge Function `figur-besked` med header `x-cron-secret` (læst fra `app_secrets` i SQL).
Edge Function `figur-besked`, tilstande: `duel` (straks-besked ved ny udfordring, kaldt af trigger på `duels`), `run` (dagens besked, højst én pr. person/døgn: duel > bekræftelse > inaktivitet),
`cleanup`, `init`, `test` (fra appen med brugerens login). Funktionen er deployet med `verify_jwt: false`.

## Konventioner
- Brug kun den **publishable** Supabase-nøgle i frontend — aldrig service_role.
- Datoer: brug `localISO()` fra `game.js` (lokal dato), ikke `toISOString().slice(0,10)`. Serveren bruger `dk_today()`.
- Tal på dansk: `toLocaleString('da-DK')`. Ejefald: `genitive()` ("Mads'", "Hannes").
- Design: lys baggrund `#f3f2ee`, sorte 3px kanter med forskudt skygge, pixel-skrift "Silkscreen" til overskrifter,
  "Plus Jakarta Sans" til brødtekst, blå `#2f66f3`, orange `#e8553d`, grøn `#3f9d6a`. Mobil først (bundmenu < 860px).
- Test i preview-buildet med en headless browser i 390px bredde, før der pushes.
- Commit-beskeder på dansk.
