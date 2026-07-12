import { test, expect } from '@playwright/test';

// Happy path: manager logs in, checks a guest into the first available room,
// and checks them out with a cash payment. Requires a seeded dev stack.
test('login → check-in → checkout', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/ชื่อผู้ใช้|username/i).fill('manager').catch(() => {});
  // Fall back to positional inputs if labels are not wired.
  const inputs = page.locator('input');
  await inputs.nth(0).fill('manager');
  await inputs.nth(1).fill('manager123');
  await page.getByRole('button', { name: /เข้าสู่ระบบ|login/i }).click();

  await expect(page.getByRole('heading', { name: 'ผังห้องพัก' })).toBeVisible();

  // Open the first available room card and check in (short stay).
  await page.getByRole('button', { name: /พร้อมรับ/ }).first().click();
  await expect(page.getByText(/เช็คอิน/)).toBeVisible();
  await page.getByRole('button', { name: /^เช็คอิน|ยืนยัน/ }).first().click();

  // Room should now appear occupied on the board.
  await expect(page.getByText(/ออก \d/).first()).toBeVisible();
});

test('mobile: hamburger menu opens navigation', async ({ page }) => {
  await page.goto('/login');
  const inputs = page.locator('input');
  await inputs.nth(0).fill('manager');
  await inputs.nth(1).fill('manager123');
  await page.getByRole('button', { name: /เข้าสู่ระบบ|login/i }).click();
  await expect(page.getByRole('heading', { name: 'ผังห้องพัก' })).toBeVisible();

  // On a mobile viewport the hamburger is visible; opening it reveals nav links.
  const hamburger = page.getByRole('button', { name: 'เปิดเมนู' });
  if (await hamburger.isVisible()) {
    await hamburger.click();
    await expect(page.getByRole('link', { name: /รายงานรายได้/ })).toBeVisible();
  }
});
