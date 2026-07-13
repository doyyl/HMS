-- Real-Postgres-only DDL (Supabase). NOT applied under the pglite test driver,
-- which lacks btree_gist. Idempotent. The service layer also checks availability;
-- this constraint is the hard concurrency backstop against double-booking.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_no_overlap') THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_no_overlap
      EXCLUDE USING gist (
        room_id WITH =,
        daterange(check_in_date, check_out_date) WITH &&
      )
      WHERE (status IN ('pending_payment', 'confirmed', 'checked_in'));
  END IF;
END $$;
