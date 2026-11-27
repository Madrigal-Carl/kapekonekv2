import { expect, test } from '@playwright/test'

// M15 / BUILD-GUIDE: sign in as every seeded handle (README "Seed accounts") and land where the table says.
// Needs a fresh `npm run migrate:fresh -- --seed`: farmer.nomail must still have to set its password.
const HANDLES = [
  ['kaluppa', /\/dashboard\/overview/, /Good (morning|afternoon|evening), Kaluppa/],
  ['manager.santacruz', /\/dashboard\/overview/, /4 farmers are waiting/],
  ['manager.boac', /\/dashboard\/overview/, /Good (morning|afternoon|evening)/],
  ['manager.unassigned', /\/dashboard\/overview/, /association/i],
  ['farmer.approved', /\/dashboard\/overview/, /Good (morning|afternoon|evening), Rodel/],
  ['farmer.pending', /\/dashboard\/overview/, /3 of 5 kg|waiting for approval/i],
  ['farmer.new', /\/dashboard/, /association/i],
  ['farmer.nomail', /\/set-password|\/dashboard\/first-password|password/i, /new password/i],
  ['farmer.rejected', /\/dashboard\/overview/, /Your request wasn’t approved/],
  ['farmer.transfer', /\/dashboard\/overview/, /Good (morning|afternoon|evening)/],
  ['farmer.unverified', /\/verify-email/, /verify/i],
  ['buyer', /\/$/, /coffee/i],
  ['buyer.unverified', /\/verify-email/, /verify/i],
  ['buyer01', /\/$/, /coffee/i],
]

for (const [handle, url, text] of HANDLES) {
  test(`${handle} signs in and lands where the seed table says`, async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email or username').fill(handle)
    await page.getByLabel('Password', { exact: true }).fill('KapeKonek@123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'))
    await expect(page).toHaveURL(url)
    await expect(page.getByText(text).first()).toBeVisible()
  })
}
