# SARTHI 2.0 — सारथी

**Guiding every patient to the right care.**

Runs in two modes from the exact same codebase:

- **Demo mode** (default, zero setup): everything runs in your browser via
  localStorage — great for a quick look or offline pitch demo.
- **Production mode** (real backend): flip it on by adding free-tier API
  keys to `.env` — real Postgres database, real per-role login with RLS
  security, real cross-device sync, real road-routing ETAs, real AI
  ranking rationale, and real push notifications that arrive even when the
  app is closed.

No code changes are needed to switch — `src/lib/db.js` detects your `.env`
and routes every page to the right backend automatically.

## Run it right now (demo mode)

```bash
npm install
npm run dev
```

That's it — pick any role on the login screen, no signup needed.

## Go to production mode (~15 minutes, everything free forever)

### 1. Supabase (database, auth, realtime) — free tier, no credit card

1. Go to [supabase.com](https://supabase.com) → New project.
2. Once it's ready: **SQL Editor → New query** → paste the contents of
   `supabase/schema.sql` → Run.
3. New query again → paste `supabase/seed.sql` → Run. This loads the demo
   Pune-district hospital/PHC/ambulance network as real rows.
4. **Settings → API** → copy the **Project URL** and **anon public** key
   into your `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. Restart `npm run dev`. The login screen now shows a **Live** badge, and
   "Sign Up" creates real accounts.

### 2. Gemini (real AI ranking rationale) — free tier, no credit card

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Create
   API key.
2. `VITE_GEMINI_API_KEY=...` in `.env`.
3. Every new referral now gets a short AI-written rationale for the top
   hospital match, shown under "Hospital candidates ranked" on the PHC
   dashboard. If the API is unreachable or the key is missing, the app
   silently keeps using the built-in rule-based explanation — nothing breaks.

### 3. Real push notifications — free forever, no external account

```bash
npx web-push generate-vapid-keys
```

1. Put the **public** key in `.env` as `VITE_VAPID_PUBLIC_KEY`.
2. Deploy the two included Edge Functions (needs the free
   [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase functions deploy engine-tick
   supabase functions deploy send-push
   ```
3. In the Supabase dashboard, set secrets for `send-push`:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (from step 1).
4. **Database → Webhooks → Create a new hook**: table `referral_events`,
   event `Insert`, type `Supabase Edge Function`, function `send-push`.
   Now every status change pushes a real notification to every relevant
   device, tab open or not.
5. **Edge Functions → engine-tick → Cron** → schedule every 15–30s. This
   keeps hospital-response timeouts and ambulance tracking running
   server-side, so it works even if nobody has the app open — required for
   a real always-on deployment (the in-browser tick in `supabaseDb.js`
   still runs too, as a redundant belt-and-braces backup).

### 4. Deploy the app itself

```bash
npm run build
```

Push `dist/` to Vercel/Netlify (both free tiers), with the same `.env`
variables set in their dashboard. `vercel.json` / `public/_redirects` are
already included so client-side routing works correctly.

## What's real now vs. still simplified

| Feature | Status |
|---|---|
| Database, auth, RLS security, realtime sync | **Real** — Postgres via Supabase, once configured |
| Cross-device notifications | **Real** — Web Push, once VAPID + Edge Functions are set up |
| Road-network ETA | **Real** — OSRM public routing server, with offline fallback to estimated distance |
| AI ranking rationale | **Real** — Gemini, once a key is added; local heuristic scoring still does the actual eligibility filtering + ranking (by design — AI explains, never decides) |
| Offline-tolerant referral creation | **Real** — IndexedDB queue, auto-syncs on reconnect |
| Background escalation/tracking | **Real** in two layers — client tick for responsiveness, Edge Function cron for always-on reliability |
| Ambulance GPS | **Still simulated** — interpolated between PHC and hospital over the dispatch ETA. Swapping in a real GPS/108-integration feed only requires updating the `current_lat`/`current_lng` columns from that device instead of the tick function — the rest of the app (map, tracking, rerouting) needs no changes. |

## Demo walkthrough

Same as before — see the in-app "What you'll see here" preview on each
role's login card. In production mode, sign up as a PHC and a hospital in
two different browser profiles (or one normal + one incognito window) to
see real cross-account, cross-device sync end to end.

## Project structure (what's new in 2.0)

```
supabase/
  schema.sql              Full Postgres schema + RLS policies
  seed.sql                 Demo network data (auto-generated from src/data/seed.js)
  functions/
    engine-tick/           Server-side escalation + ambulance tracking (cron)
    send-push/              Real Web Push delivery (triggered by DB webhook)
src/lib/
  db.js                    Facade — auto-picks localDb.js or supabaseDb.js
  localDb.js                Demo backend (unchanged from 1.0)
  supabaseDb.js              Production backend — real Postgres + Realtime
  supabaseClient.js           Supabase client singleton
  offlineQueue.js              IndexedDB queue for offline referral creation
  push.js                       Push subscription management
public/
  sw.js                    Service worker — offline shell + push receiver
  manifest.json             PWA manifest (installable on phones)
```

Everything else (components, pages, design system) is unchanged from 1.0 —
see the previous README section below for the full demo walkthrough and
design notes if you need them.
