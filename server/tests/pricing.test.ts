import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRICING,
  pricingFromSettings,
  shortStayCharge,
  shouldOfferOvernight,
  overnightCharge,
} from '../src/domain/pricing/index.js';

const cfg = DEFAULT_PRICING;

describe('shortStayCharge', () => {
  it('charges base price for the first 2 hours (0 extensions)', () => {
    const c = shortStayCharge(0, cfg);
    expect(c.total).toBe(200);
    expect(c.baseAmount).toBe(200);
    expect(c.extensionHours).toBe(0);
  });

  it('adds 50 baht per extension hour', () => {
    expect(shortStayCharge(1, cfg).total).toBe(250); // 3h
    expect(shortStayCharge(2, cfg).total).toBe(300); // 4h
    expect(shortStayCharge(3, cfg).total).toBe(350); // 5h
    expect(shortStayCharge(5, cfg).total).toBe(450); // 7h
    expect(shortStayCharge(6, cfg).total).toBe(500); // 8h
  });

  it('tracks extension hours and amount', () => {
    const c = shortStayCharge(5, cfg);
    expect(c.extensionUnits).toBe(5);
    expect(c.extensionHours).toBe(5);
    expect(c.extensionAmount).toBe(250);
  });

  it('clamps negative/fractional units to a whole non-negative number', () => {
    expect(shortStayCharge(-3, cfg).total).toBe(200);
    expect(shortStayCharge(2.9, cfg).extensionUnits).toBe(2);
  });
});

describe('shouldOfferOvernight', () => {
  it('does not offer for short stays under the thresholds', () => {
    expect(shouldOfferOvernight(shortStayCharge(0, cfg), cfg)).toBe(false);
    expect(shouldOfferOvernight(shortStayCharge(4, cfg), cfg)).toBe(false); // 4h ext, 400฿
  });

  it('offers once extension hours reach 5 (the binding trigger with defaults)', () => {
    expect(shouldOfferOvernight(shortStayCharge(5, cfg), cfg)).toBe(true); // 5h ext, 450฿
  });

  it('offers once total reaches the baht threshold', () => {
    expect(shouldOfferOvernight(shortStayCharge(6, cfg), cfg)).toBe(true); // 500฿
  });
});

describe('overnightCharge', () => {
  it('standard check-in at 11:00 -> checkout 11:00 next day, no fee', () => {
    const checkIn = new Date(2026, 5, 29, 11, 0); // 29 Jun 2026 11:00
    const r = overnightCharge(checkIn, false, cfg);
    expect(r.total).toBe(500);
    expect(r.earlyCheckin).toBe(false);
    expect(r.earlyCheckinFee).toBe(0);
    expect(r.expectedCheckoutAt.getDate()).toBe(30);
    expect(r.expectedCheckoutAt.getHours()).toBe(11);
  });

  it('afternoon check-in -> checkout 11:00 next day', () => {
    const checkIn = new Date(2026, 5, 29, 20, 30);
    const r = overnightCharge(checkIn, false, cfg);
    expect(r.expectedCheckoutAt.getDate()).toBe(30);
    expect(r.expectedCheckoutAt.getHours()).toBe(11);
    expect(r.earlyCheckin).toBe(false);
  });

  it('early check-in (before 11:00) without paying -> checkout 18:00 same day', () => {
    const checkIn = new Date(2026, 5, 29, 8, 0);
    const r = overnightCharge(checkIn, false, cfg);
    expect(r.earlyCheckin).toBe(true);
    expect(r.earlyCheckinFee).toBe(0);
    expect(r.total).toBe(500);
    expect(r.expectedCheckoutAt.getDate()).toBe(29); // same day
    expect(r.expectedCheckoutAt.getHours()).toBe(18);
  });

  it('early check-in with +50 fee -> checkout 11:00 next day', () => {
    const checkIn = new Date(2026, 5, 29, 8, 0);
    const r = overnightCharge(checkIn, true, cfg);
    expect(r.earlyCheckin).toBe(true);
    expect(r.earlyCheckinFee).toBe(50);
    expect(r.total).toBe(550);
    expect(r.expectedCheckoutAt.getDate()).toBe(30);
    expect(r.expectedCheckoutAt.getHours()).toBe(11);
  });

  it('handles month/year rollover on the next-day checkout', () => {
    const checkIn = new Date(2026, 11, 31, 23, 0); // 31 Dec 2026 23:00
    const r = overnightCharge(checkIn, false, cfg);
    expect(r.expectedCheckoutAt.getFullYear()).toBe(2027);
    expect(r.expectedCheckoutAt.getMonth()).toBe(0);
    expect(r.expectedCheckoutAt.getDate()).toBe(1);
    expect(r.expectedCheckoutAt.getHours()).toBe(11);
  });
});

describe('pricingFromSettings', () => {
  it('parses string settings into numbers and falls back on bad values', () => {
    const p = pricingFromSettings({ SHORT_BASE_PRICE: '250', OVERNIGHT_PRICE: 'oops' });
    expect(p.shortBasePrice).toBe(250);
    expect(p.overnightPrice).toBe(DEFAULT_PRICING.overnightPrice);
  });
});
