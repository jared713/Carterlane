# Carterlane

A direct-booking site for a single holiday let: a Next.js front end on Vercel,
a Node/Postgres booking API on Railway, and an owner area for setting dates,
rates and photographs.

```
web/   Next.js 16 (App Router, TypeScript, Tailwind)  →  Vercel
api/   Express + Postgres                             →  Railway
```

## What it does

**For guests** — a hero with a motion video of St Paul's, a gallery of the
flat, a rates table, and a two-month availability calendar with live per-night
pricing. Choosing dates prices the stay as they go; sending the form holds the
nights and emails both sides. No payment is taken online.

**For you** — `/admin`, behind a single password:

| Tab | What it does |
|---|---|
| Calendar | Click a first and last night, then close them or put them back on sale |
| Bookings | Confirm or cancel requests; cancelling releases the nights immediately |
| Rates | Seasonal pricing with its own minimum stay; overlaps resolve by priority |
| Photos | Drag in photographs, caption and reorder them; they resize automatically |
| Details | Standard rate, cleaning charge, capacity, description, amenities, contact |

Everything the public site shows comes from the database, so none of it needs
a redeploy to change.

---

## Deploying

### 1. The API on Railway

1. **New Project → Deploy from GitHub repo**, pick this repository.
2. **Settings → Source → Root Directory: `api`**, then save. This one is not
   optional: without it Railway builds from the repository root, sees `api/`
   and `web/` side by side, and fails with *"could not determine how to build
   the app"*. With it set, the builder finds a plain Node app and
   `api/railway.json` points the health check at `/health`.
3. **New → Database → Add PostgreSQL** in the same project, then add
   `DATABASE_URL=${{Postgres.DATABASE_URL}}` to the API service — typed with
   the braces, as a variable reference rather than a pasted connection string.
   (Substitute the database service's real name if you renamed it.) The schema
   is created on first boot, so there is no migration step to run.
4. Add these variables to the API service:

   | Variable | Value |
   |---|---|
   | `SESSION_SECRET` | 32+ random characters (`openssl rand -base64 32`) |
   | `ADMIN_PASSWORD` | the password for `/admin` |
   | `OWNER_EMAIL` | where booking requests are emailed |
   | `ALLOWED_ORIGINS` | your Vercel URL, comma-separated for more than one |
   | `ALLOW_VERCEL_PREVIEWS` | `true` if you want preview deploys to work |

   Leave `ALLOWED_ORIGINS` out until Vercel is up — an empty value allows any
   origin, so the site works immediately, and you can lock it down afterwards.
   Do not set `PORT`: Railway provides it, and overriding it breaks the health
   check.

5. **Settings → Networking → Generate Domain** and note the URL.

Optional, for real email rather than console logs: `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Without them the API logs each message
it would have sent, and bookings still work.

### 2. The front end on Vercel

1. **Add New → Project**, pick this repository.
2. Set **Root Directory** to `web`. The framework preset is Next.js.
3. Environment variables:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | the Railway URL from step 1, no trailing slash |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel or custom domain |

4. Deploy, then go back to Railway and put the Vercel URL in `ALLOWED_ORIGINS`.

### 3. Make it yours

- Drop your video in `web/public/media/st-pauls.mp4` — see
  [the notes there](web/public/media/README.md) for size and format.
- Open `/admin`, sign in, and upload the flat photos. The first one becomes the
  large image in the gallery.
- Under **Details**, set the standard rate, cleaning charge and description.

---

## Running it locally

```bash
# Postgres
createdb carterlane

# API
cd api
cp .env.example .env          # set DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD
npm install
npm run seed                  # optional: sample copy, two seasons, one closed week
npm run dev                   # http://localhost:4000

# Front end, in a second terminal
cd web
echo 'NEXT_PUBLIC_API_URL=http://localhost:4000' > .env.local
npm install
npm run dev                   # http://localhost:3000
```

Then `npm run smoke` in `api/` (with the API running) exercises the whole flow
end to end — pricing, blocking, double-booking, uploads — against a live server:

```bash
cd api
BASE_URL=http://localhost:4000 ADMIN_PASSWORD=yourpassword node test/smoke.mjs
```

It creates its own bookings, rates, blocks and photos and cleans them up after.

---

## How it works

### Nights, not days

A night is named by the date it starts on. A booking of 4th → 7th occupies the
nights of the 4th, 5th and 6th, so somebody else can arrive on the 7th. The
calendar, the blocks and the pricing all use the same convention, which is why
back-to-back stays don't collide.

### No double bookings

Creating a booking takes a Postgres advisory lock, re-checks availability inside
the transaction, and only then inserts. Two guests submitting the same nights at
the same moment: one gets the booking, the other gets a 409 and a refreshed
calendar. Re-instating a cancelled booking runs the same check.

### Pricing

Each night is priced independently: the highest-priority rate rule covering it
wins, otherwise the standard rate applies. A rule can also raise the minimum
stay for the nights it covers — which is how a four-night minimum over Christmas
sits inside an otherwise two-night season. The cleaning charge is added once.

### Photographs

Uploads are resized to fit 2400px, converted to WebP and stored in Postgres, so
there is no object store to configure and nothing to lose when a container is
replaced. They are served with an immutable cache header; a replacement gets a
new id. The public site re-reads the gallery every 60 seconds, so a new photo
appears within a minute of upload.

### Admin access

One password, checked with bcrypt, exchanged for a 12-hour JWT held in
`localStorage` and sent as a bearer token. That keeps the API stateless across
origins without third-party cookies. Sign-in is rate limited to 8 attempts per
10 minutes, and booking submissions to 10 per 15 minutes.

---

## Things you might want next

- **Taking payment.** The booking flow deliberately stops at a request. Adding
  Stripe Checkout means a payment intent on submit and a webhook that promotes
  the booking from `pending` to `confirmed`.
- **iCal sync.** Exporting `/api/calendar.ics` and importing Airbnb's feed into
  `blocks` would keep two platforms from selling the same night.
- **More than one flat.** The schema keeps a `property` table with a single row
  for exactly this reason; adding a `property_id` to `blocks`, `rate_rules`,
  `bookings` and `photos` is the whole change.
