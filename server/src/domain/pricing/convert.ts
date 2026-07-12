import type { PricingConfig } from './config.js';
import type { ShortStayCharge } from './shortStay.js';

/**
 * Whether the front desk should offer to convert a short stay into an overnight
 * (flat) rate. Triggered when the running room total reaches the baht threshold
 * OR the extension hours reach the hour threshold (whichever comes first).
 *
 * With defaults this first fires at 5 extended hours (= 7h total, 450฿).
 */
export function shouldOfferOvernight(charge: ShortStayCharge, cfg: PricingConfig): boolean {
  return (
    charge.total >= cfg.convertTotalThreshold ||
    charge.extensionHours >= cfg.convertExtHoursThreshold
  );
}
