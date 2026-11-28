import { expect, test } from '@playwright/test'

// Change 06F: with Maya saved but off (the seed), no page outside Settings → E-wallet mentions it,
// and the payment copy names GCash. Needs `npm run migrate:fresh -- --seed`.
async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function noMaya(page, path) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body'), `${path} mentions Maya`).not.toContainText('Maya')
}

test('storefront: GCash in the copy, no Maya', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('pay by GCash or cash on delivery').first()).toBeVisible()
  await expect(page.getByText('GCash with a receipt upload, or cash on delivery.')).toBeVisible()
  await expect(page.getByText('Kaluppa confirms each order within 3 days')).toHaveCount(0)
  await noMaya(page, '/')
  await noMaya(page, '/products')
  await page.goto('/products/liberica-green-beans')
  await expect(page.getByText('Pay by GCash or cash on delivery.')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Maya')
})

test('buyer orders and Kaluppa orders: no Maya', async ({ page }) => {
  await signIn(page, 'buyer')
  await noMaya(page, '/orders')
  await page.getByRole('link', { name: /^View order|KK-/ }).first().click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).not.toContainText('Maya')
  await page.context().clearCookies()
  await signIn(page, 'kaluppa')
  await noMaya(page, '/dashboard/orders')
  await page.getByRole('button', { name: /^Manage / }).first().click()
  await expect(page.getByRole('dialog').last()).not.toContainText('Maya')
})
