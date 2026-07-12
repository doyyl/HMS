import type { PricingConfig } from './config.js';

export interface ShortStayCharge {
  /** Base charge covering the first `shortBaseHours` hours. */
  baseAmount: number;
  /** Number of extension blocks purchased. */
  extensionUnits: number;
  /** Total extended hours (units * shortExtHours). */
  extensionHours: number;
  /** Charge for all extension blocks. */
  extensionAmount: number;
  /** baseAmount + extensionAmount. */
  total: number;
}

/**
 * Compute the short-stay (ชั่วคราว) room charge for a given number of extension
 * blocks. `extensionUnits = 0` is the base 2-hour stay.
 *
 * Example (defaults 200฿/2h, +50฿/h):
 *   units 0 -> 200, units 1 -> 250, units 3 -> 350, units 5 -> 450.
 */
export function shortStayCharge(extensionUnits: number, cfg: PricingConfig): ShortStayCharge {
  const units = Math.max(0, Math.trunc(extensionUnits));
  const extensionAmount = units * cfg.shortExtPrice;
  const extensionHours = units * cfg.shortExtHours;
  return {
    baseAmount: cfg.shortBasePrice,
    extensionUnits: units,
    extensionHours,
    extensionAmount,
    total: cfg.shortBasePrice + extensionAmount,
  };
}
