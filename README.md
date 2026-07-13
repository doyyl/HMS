# ระบบจัดการโรงแรม (Hotel Management System)

Front-desk app for a 20-room hotel (Building A: A1–A10, Building B: B1–B10).
React UI + Node/Express + **Supabase (Postgres + Storage)**. Slip images live in
a private Supabase Storage bucket; QR-payment slips are required before a shift
can close.

> ⚠️ **Connectivity:** the database is now cloud-hosted (Supabase), so the front
> desk needs internet to operate. Put the desk on reliable/wired internet with a
> UPS + 4G failover — an outage blocks check-ins, payments, and shift close.

## Features

- **ผังห้องพัก (Room board)** — live status of all 20 rooms, colour-coded by
  occupancy / overdue / awaiting-cleaning.
- **Two rate types**
  - **ชั่วคราว (short-stay)** — 200฿ / 2 h, +50฿ / h. When the total reaches 500฿
    or 5 extended hours, the app offers a manual switch to the flat overnight rate.
  - **ค้างคืน (overnight)** — 500฿ / night, check-in 11:00 → checkout 11:00 next day.
    Early check-in (before 11:00) → checkout 18:00 same day, unless +50฿ keeps the
    11:00 next-day checkout.
- **ทะเบียนรถ + จังหวัด** captured at check-in (77-province dropdown).
- **สถานะทำความสะอาด** — rooms become *dirty* on checkout and must be marked clean
  before re-booking.
- **สินค้าเสริม (supplementary sales)** — staff POS, plus **in-room customer
  self-ordering** (scan the room QR → order → staff accept → added to the folio).
- **การชำระเงิน** — cash or QR. QR payments **require a slip photo**; a work shift
  **cannot be closed** while any QR payment is missing its slip.
- **เงินสด / กะ (cash drawer)** — opening change-float, cash reconciliation at close.
  The opening float (*เงินตั้งต้นที่ให้ไปทอนลูกค้า*) is **editable only by a manager**;
  staff see it read-only.
- **รายงานรายได้** — day / month / year, split by cash vs QR and by category, CSV export.
- **Roles** — Manager (full access) and Staff (everything except editing the cash
  float, pricing/time settings, and user management).

## Quick start

1. Create a Supabase project. Copy the **Transaction pooler** connection string
   (Settings → Database, port 6543) and create a **private** Storage bucket named
   `slips`.
2. `cp server/.env.example server/.env` and fill in `DATABASE_URL`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`, and a strong `JWT_SECRET`.
3. Run:

```bash
npm install
npm run seed        # applies schema to Postgres, seeds 20 rooms, users, sample products
npm run dev         # server on :4000, web dev server on :5173 (proxies /api)
```

> Local dev without Supabase: point `DATABASE_URL` at any local Postgres and leave
> `SUPABASE_URL` blank — slips fall back to local disk (`server/uploads/`).
> The server sets `TZ=Asia/Bangkok`; keep that env in production so pricing/time
> math stays correct regardless of host timezone.

Open <http://localhost:5173> (dev) — or build and run the single server:

```bash
npm run build       # builds web/dist
npm run start --workspace server   # serves API + SPA on :4000
```

### Default logins (change after first run via ผู้ใช้งาน)

| Role | Username | Password |
|---|---|---|
| ผู้จัดการ (Manager) | `manager` | `manager123` |
| พนักงาน (Staff) | `staff` | `staff123` |

### Customer in-room ordering

Each room has a rotating `order_token`. Print a QR pointing at
`http://<lan-ip>:4000/order/<token>` and place it in the room. Orders only work
while the room has an active booking; they land in **คำสั่งซื้อจากลูกค้า** for staff to accept.

## Progressive Web App (PWA) & mobile

The web app is installable and responsive. On a phone, staff get a hamburger
drawer; the sidebar shows on tablet/desktop. "Add to Home Screen" installs it as
a standalone app. `/api/*` is always fetched from the network (never served from
the cache) so POS data is never stale — the app shell is precached for fast loads.

## Tests

```bash
npm test            # unit (pricing) + integration (API) — vitest, TZ=Asia/Bangkok
```

Integration tests run against an in-process Postgres (**pglite**) — no database
setup required. They cover auth, the booking lifecycle, shift/payment void
reconciliation, order accept/reject, and the reservation flow.

End-to-end (Playwright) runs against a live dev stack:

```bash
cd web && npm i -D @playwright/test && npx playwright install
npm run dev            # from repo root (server :4000 + web :5173)
npm run seed           # once, to seed rooms/users/products
cd web && npm run test:e2e
```

## Reservations (advance booking)

Staff can take phone reservations under **การจองล่วงหน้า**: pick a date range,
the app shows rooms free for the whole span, and confirmed reservations appear in
an "arrivals today" panel. Checking a reservation in creates a normal booking, so
checkout / folio / in-room ordering all work unchanged. A background sweep expires
unpaid holds and flags no-shows. Online guest booking + 2C2P prepayment is the
next phase (see `.env.example` `TWOC2P_*`).

## Deployment

Single-process deploy: the server serves the built SPA from `web/dist` and the
API on the same port.

```bash
cp server/.env.example server/.env   # fill DATABASE_URL, JWT_SECRET, CORS_ORIGINS, PUBLIC_BASE_URL
npm ci
npm run start:prod                   # builds web, then runs the server with NODE_ENV=production
```

Production requirements:

- **`NODE_ENV=production`** — the server refuses to boot on the default/weak
  `JWT_SECRET`. Set a strong secret (≥16 chars).
- **`CORS_ORIGINS`** — comma-separated allowlist of the browser origin(s).
- **`DATABASE_URL`** — Supabase transaction pooler (SSL auto-enabled for non-local hosts).

Run under a process manager so it restarts on crash/reboot. PM2:

```bash
npm run build
pm2 start "npm run start --workspace server" --name hms --update-env
pm2 save && pm2 startup
```

Or systemd (`/etc/systemd/system/hms.service`): run `npm run start --workspace
server` in `WorkingDirectory=/opt/hms` with `Environment=NODE_ENV=production`
and `EnvironmentFile=/opt/hms/server/.env`, `Restart=always`.

- **Health check:** `GET /api/health` returns `200 {ok:true,db:"up"}` and `503`
  if the database is unreachable — point your load balancer / uptime monitor at it.
- **Graceful shutdown:** `SIGTERM`/`SIGINT` stop new connections and drain the DB pool.
- **Backups:** database lives in Supabase (managed daily backups; enable PITR for
  finer recovery). Slip images are in the private Supabase Storage bucket.
- **Schema:** applied idempotently on boot; the `btree_gist` overlap constraint
  (double-booking guard) is applied only against real Postgres.

## Configuration

Pricing and time constants live in the `settings` table and are editable by a
manager under **ตั้งค่า**. Server settings via env (see `.env.example`): `PORT`,
`NODE_ENV`, `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS`, `PUBLIC_BASE_URL`,
`SUPABASE_*`, `UPLOADS_DIR`.

## Notes / tradeoffs

- **Data lives in Supabase Postgres** (managed backups on Supabase). The Express
  server holds no persistent state — deploy it anywhere.
- Slip images are in a **private Supabase Storage bucket**, served to staff via
  short-lived signed URLs.
- Timestamps are `timestamptz` (UTC); reports group by Asia/Bangkok calendar day.
- The auth token is kept in `localStorage` — fine for a trusted terminal; not for
  public-internet exposure.
- The service-role key is **server-only** — it is never sent to the browser.
- Receipts print via the browser; a thermal-printer driver can be added later.
