export interface PricingConfig {
  shortBasePrice: number;
  shortBaseHours: number;
  shortExtPrice: number;
  shortExtHours: number;
  convertTotalThreshold: number;
  convertExtHoursThreshold: number;
  overnightPrice: number;
  overnightCheckinHour: number;
  overnightCheckoutHour: number;
  earlyCheckoutHour: number;
  earlyCheckinFee: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  shortBasePrice: 200,
  shortBaseHours: 2,
  shortExtPrice: 50,
  shortExtHours: 1,
  convertTotalThreshold: 500,
  convertExtHoursThreshold: 5,
  overnightPrice: 500,
  overnightCheckinHour: 11,
  overnightCheckoutHour: 11,
  earlyCheckoutHour: 18,
  earlyCheckinFee: 50,
};

/** Build a PricingConfig from the string key/value settings table. */
export function pricingFromSettings(s: Record<string, string>): PricingConfig {
  const num = (key: string, fallback: number): number => {
    const v = s[key];
    const n = v === undefined ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    shortBasePrice: num('SHORT_BASE_PRICE', DEFAULT_PRICING.shortBasePrice),
    shortBaseHours: num('SHORT_BASE_HOURS', DEFAULT_PRICING.shortBaseHours),
    shortExtPrice: num('SHORT_EXT_PRICE', DEFAULT_PRICING.shortExtPrice),
    shortExtHours: num('SHORT_EXT_HOURS', DEFAULT_PRICING.shortExtHours),
    convertTotalThreshold: num('CONVERT_TOTAL_THRESHOLD', DEFAULT_PRICING.convertTotalThreshold),
    convertExtHoursThreshold: num('CONVERT_EXT_HOURS_THRESHOLD', DEFAULT_PRICING.convertExtHoursThreshold),
    overnightPrice: num('OVERNIGHT_PRICE', DEFAULT_PRICING.overnightPrice),
    overnightCheckinHour: num('OVERNIGHT_CHECKIN_HOUR', DEFAULT_PRICING.overnightCheckinHour),
    overnightCheckoutHour: num('OVERNIGHT_CHECKOUT_HOUR', DEFAULT_PRICING.overnightCheckoutHour),
    earlyCheckoutHour: num('EARLY_CHECKOUT_HOUR', DEFAULT_PRICING.earlyCheckoutHour),
    earlyCheckinFee: num('EARLY_CHECKIN_FEE', DEFAULT_PRICING.earlyCheckinFee),
  };
}
