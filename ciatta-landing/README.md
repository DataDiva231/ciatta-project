# Ciatta — waitlist landing page

A single-page pre-launch site for Ciatta. React + Vite + TypeScript, no UI
framework. Adapted from the Figma Make file
`Jfpz1Bii9CpmnxuyiaQv4l` (*Landing page for Ciatte*).

## What changed from the Figma source

The Figma version was a working prototype, not a shippable page. Three things
were wrong for this product and are fixed here:

| Figma source | Here | Why |
|---|---|---|
| Brand spelled **ciatte** | **Ciatta** | Everything else — App Store listing, bundle id `com.ciatta.mobileapp`, the logo — says Ciatta |
| Green `#22c55e` accent | Living Coral `#F27D72` | The app's accent, straight from `ciatta-mobile-app/src/theme/tokens.ts`. Canvas, surface and the three inks match that file exactly too |
| Sleep / Movement / **Nutrition** / Mood | Sleep / Recovery / **Cycle** / Energy / Mood | The real five domains. Ciatta has no nutrition logging, and cycle — the reason it's a women's health app — was missing entirely |

Copy was rewritten to describe what the app does (observes and reports
patterns) rather than habit tracking, which it isn't.

The Figma form threw the email away (`setSubmitted(true)` and nothing else).
Here it writes to Supabase.

## Setup

```bash
npm install
cp .env.example .env      # fill in from the Supabase dashboard
npm run dev
```

`npm run build` typechecks and bundles to `dist/`. `npm run preview` serves
that build.

## The waitlist needs one migration applied

`ciatta-mobile-app/supabase/migrations/20260838000000_waitlist.sql` creates the
table. **It has not been applied yet** — until it is, submitting shows an
honest error and saves nothing:

```
PGRST205: Could not find the table 'public.waitlist' in the schema cache
```

Apply it with `supabase db push` from `ciatta-mobile-app/`, or paste the file
into the SQL editor.

### Why the browser key is safe here

The page ships the publishable key, so RLS is the only boundary. The policy set
is deliberately lopsided: `anon` may **INSERT** and nothing else. There is no
`SELECT` policy, so the same key that writes cannot enumerate the list — a
signup form must never double as an email scraper.

Read signups from the dashboard or with the service role:

```sql
select email, source, created_at from public.waitlist order by created_at desc;
```

Uniqueness is case-insensitive on `lower(email)`. A repeat signup comes back as
`23505` and the page says "you're already on the list" rather than reporting a
failure.

## Things left deliberately open

- **The bundled Söhne files are subsetted.** `Sohne-Buch`, `-Halbfett` and
  `-Kraftig` have no `'`, `%`, `·`, `✓` or `×`. Those characters silently render
  in the fallback face next to Söhne text. The list markers and the caption
  separator are drawn in CSS to avoid it, but the `%` in every confidence figure
  still falls back — that one needs complete font files.
- **`public/` ships 2.4 MB nothing references.** `splash-ciatta.png` (1.8 MB) and
  `silhouette-full.png` (534 kB) are copied into `dist/` and are 77% of the build.
  Delete them or move them to the app repo.
- **No analytics.** Nothing is tracked beyond the signup row.
- **`/privacy` and `/terms` are dead links.** The footer points at routes that
  don't exist yet — worth closing before launch, since the page makes specific
  promises about data handling.
- **No confirmation email.** Joining writes a row; nobody is emailed. Wiring
  that up needs an edge function and a sending domain.
