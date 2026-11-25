# Genvejen "Motionsligaen skridt"

Genvejen læser dagens skridt fra Sundhed og sender dem til Motionsligaen.
Mads bygger den **én gang** og deler et iCloud-link. Resten af familien installerer linket og
indsætter deres egen kode fra appen (Min figur → Skridttæller → Forbind skridttæller).

Navnene på handlingerne står på dansk med de engelske navne i parentes; søg på et af dem.

## 1. Byg genvejen (Mads, én gang)

1. Åbn **Genveje** → **+**. Kald genvejen **Motionsligaen skridt**.
2. Tilføj **Find sundhedsprøver** (*Find Health Samples*):
   - Type: **Skridt** (*Steps*)
   - Tilføj filter: **Startdato** → **er i dag** (*is today*)
   - **Grupper efter**: **Dag** (*Group By: Day*) – så lægges iPhone og Apple Watch sammen som i Sundhed-appen
3. Tilføj **Hent detaljer om sundhedsprøver** (*Get Details of Health Samples*) → **Værdi** (*Value*).
4. Tilføj **Beregn statistik** (*Calculate Statistics*) → **Sum**.
5. Tilføj **Tekst** (*Text*) og skriv din egen kode fra appen i feltet.
6. Tilføj **Hent indhold af URL** (*Get Contents of URL*):
   - URL: `https://ptpriymspqwuuhycjhch.supabase.co/functions/v1/skridt`
   - Tryk **Vis mere**: Metode **POST**, Brødtekst **JSON**
   - Felt `kode` (Tekst) = variablen **Tekst**
   - Felt `skridt` (Tal) = variablen **Statistik**
7. Tilføj **Hent ordbogsværdi** (*Get Dictionary Value*) → nøgle `besked` fra **Indhold af URL**.
8. Tilføj **Vis notifikation** (*Show Notification*) med **Ordbogsværdi**.
9. Tryk ▶︎. Første gang: **Tillad** adgang til Sundhed og til at kontakte supabase.co.
   Der bør komme en notifikation som "8.432 skridt gemt – 16 XP i dag."

## 2. Del den med familien

1. Åbn genvejen → tryk på **ⓘ** (eller navnet øverst) → **Opsæt importspørgsmål** (*Set Up Import Questions*)
   → vælg feltet i **Tekst**-handlingen og skriv spørgsmålet: *Indsæt din kode fra Motionsligaen*.
   Så bliver din egen kode ikke delt, og hver person bliver spurgt om sin.
2. **Del** → **Kopiér iCloud-link**.
3. Send linket til Claude, så det sættes ind i appen (`SHORTCUT_URL` i `src/steps.js`).
   Derefter viser appen en **Hent genvejen**-knap.

## 3. Hver person (én gang)

1. Appen → **Min figur** → **Skridttæller** → **Forbind skridttæller** → **Kopiér** koden.
2. Hent genvejen fra linket → **Tilføj genvej** → indsæt koden, når der spørges.
3. Kør genvejen én gang og tryk **Tillad**.
4. Genveje → **Automatisering** → **+** → **Tidspunkt** → **21:30**, **Dagligt** → **Kør straks** → vælg **Motionsligaen skridt**.

## Regler

- 2 XP pr. 1.000 skridt, højst 20 XP om dagen (indstillinger: `xp_per_1000_steps`, `steps_max_xp`). Tæller med i dagens XP-loft.
- Under 1.000 skridt gemmes intet. Skridt kan sendes for i dag eller i går og kun gå op i løbet af dagen.
- Skridt tæller ikke som træningsdag (ugemål og dueller), men 6.000+ skridt holder formen (`steps_form_min`).
- Skridt er automatisk bekræftet; de skal ikke godkendes af andre.
