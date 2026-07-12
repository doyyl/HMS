import type { PricingConfig } from './config.js';
import { atHourOnOffsetDay } from '../time.js';

export interface OvernightCharge {
  /** Base overnight room price (excl. fees). */
  price: number;
  /** True if the guest checked in before the standard check-in hour (11:00). */
  earlyCheckin: boolean;
  /** Fee applied to keep the next-day checkout when checking in early. */
  earlyCheckinFee: number;
  /** Computed checkout time. */
  expectedCheckoutAt: Date;
  /** price + earlyCheckinFee. */
  total: number;
}

/**
 * Compute an overnight (ค้างคืน) charge and expected checkout time.
 *
 * Rules (defaults):
 *  - Check-in at/after 11:00  -> checkout 11:00 next day.
 *  - Check-in before 11:00    -> checkout 18:00 the SAME day (cut short),
 *                                unless the guest pays the early-checkin fee
 *                                (+50฿), which restores 11:00 next-day checkout.
 */
export function overnightCharge(
  checkInAt: Date,
  payEarlyExtend: boolean,
  cfg: PricingConfig,
): OvernightCharge {
  const earlyCheckin = checkInAt.getHours() < cfg.overnightCheckinHour;

  let expectedCheckoutAt: Date;
  let earlyCheckinFee = 0;

  if (!earlyCheckin) {
    // Standard: next day at checkout hour.
    expectedCheckoutAt = atHourOnOffsetDay(checkInAt, 1, cfg.overnightCheckoutHour);
  } else if (payEarlyExtend) {
    // Early but paid to extend: keep next-day checkout.
    expectedCheckoutAt = atHourOnOffsetDay(checkInAt, 1, cfg.overnightCheckoutHour);
    earlyCheckinFee = cfg.earlyCheckinFee;
  } else {
    // Early, not paid: checkout same day at 18:00.
    expectedCheckoutAt = atHourOnOffsetDay(checkInAt, 0, cfg.earlyCheckoutHour);
  }

  return {
    price: cfg.overnightPrice,
    earlyCheckin,
    earlyCheckinFee,
    expectedCheckoutAt,
    total: cfg.overnightPrice + earlyCheckinFee,
  };
}
