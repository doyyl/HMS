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

## Tests

```bash
npm test            # pricing engine unit tests (vitest, runs under TZ=Asia/Bangkok)
```

## Configuration

Pricing and time constants live in the `settings` table and are editable by a
manager under **ตั้งค่า**. Server settings via env (see `.env.example`): `PORT`,
`JWT_SECRET`, `DB_PATH`, `UPLOADS_DIR`.

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
