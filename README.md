# Motionsligaen

En webapp til to, hvor man træner, optjener XP, får en pixel-figur, der vokser med træningen, og dyster mod hinanden.

## Opsætning (ca. 20 min)

### 1. Supabase (database og login)
1. Opret en konto på https://supabase.com og et nyt projekt (gratis).
2. Gå til **SQL Editor**, indsæt hele filen `supabase/schema.sql` og kør den.
3. Gå til **Project Settings > API** og kopiér:
   - **Project URL**
   - **anon public** nøglen (aldrig `service_role`)
4. Gå til **Authentication > Sign In / Providers > Email** og slå e-mailbekræftelse til eller fra efter ønske. Hvis den er slået til, skal hver forælder bekræfte sin e-mail.

### 2. Miljøvariabler
Kopiér `.env.example` til `.env` og udfyld:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 3. Kør lokalt (valgfrit)
```
npm install
npm run dev
```

### 4. Byg og udgiv (gratis hosting)
```
npm install
npm run build
```
Mappen `dist/` er den færdige app. Det nemmeste er at oprette en gratis konto på Netlify eller Cloudflare Pages og trække `dist/` ind på siden. Du får et link, fx `https://traendyst.netlify.app`.

### 5. Installér på iPhone
1. Åbn linket i **Safari** (ikke Chrome).
2. Tryk på **Del**-knappen og vælg **Føj til hjemmeskærm**.
3. Appen åbnes nu fuldskærm som en almindelig app.

## Første gang
- Den første konto, der oprettes, får administratorrettigheder. Det er dig.
- Når den anden forælder har oprettet sin konto, er spilleren fuld. Der kan ikke oprettes flere.
- Derefter kan I logge ind på jeres egne telefoner.

## Balance og katalog uden kodeændringer
Du kan ændre disse i Supabase under **Table Editor**:
- **settings:** XP pr. km og minut, dagligt loft, niveaukurve, trin og duel-længde.
- **items:** navn, plads, hvordan det låses op og hvilket trin det kræver. Du kan også tilføje `sprite_url` med et billede (64×64 pixels) i stedet for farveblokken.

Ændringer virker med det samme. Der skal ikke laves nye builds.

## Regler der er indbygget
- **Løb:** XP pr. km. Ingen bevis påkrævet.
- **Styrke:** XP pr. minut, men først når den anden forælder har bekræftet passet med billedet. Ingen kan bekræfte sin egen træning.
- **Andet:** XP pr. minut. Ingen bevis påkrævet.
- **Dagligt loft:** samlet XP pr. dag er begrænset af `daily_xp_cap`.
- **Duel:** én aktiv ad gangen. Den tæller træning logget efter start, og den afgøres automatisk, når tiden er gået.

## Kendte begrænsninger
- Billedet er et bevis for, at en anden har set passet, ikke et automatisk tjek af, hvad billedet viser.
- Der er endnu ingen push-notifikationer. Dueller og bekræftelser ses, når appen åbnes.
- Figuren er placeholder-farver. Pixel-sprites tilføjes via `sprite_url` i tabellen `items`.
- App-ikonet er et simpelt SVG. iPhone kan kræve et 180×180 PNG-ikon for det bedste resultat.
- Supabase's gratis projekter kan pauseres efter en periode uden brug. Tjek de aktuelle grænser på supabase.com.


## Automatisk udgivelse
Appen ligger på GitHub og er forbundet til Netlify. Hvert push til `main` bygger og udgiver appen automatisk
(`netlify.toml` styrer build-kommando, mappe og Supabase-adresse).

## Preview med eksempeldata
`npx vite build --config vite.preview.config.js` bygger en udgave med en falsk database i hukommelsen (mappen `preview/`).
