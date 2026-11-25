import { expect, test } from '@playwright/test'

// Change 05 Part E: farmer account pages (FarmerAssociation.dc.html in 4 states, FarmerAddresses.dc.html).
async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
test.use({ viewport: { width: 1440, height: 900 } })

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

const STATES = {
  'farmer.approved': async (page) => {
    await expect(page.getByText('Approved farmer', { exact: true }).last()).toBeVisible()
    await expect(page.getByText('No limit')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your Group Manager' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Move to another association' })).toBeVisible()
  },
  'farmer.pending': async (page) => {
    await expect(page.getByText('Waiting for approval').last()).toBeVisible()
    await expect(page.getByText(/kg left$/)).toBeVisible()
    // Withdraw asks first; keep the seed request.
    await page.getByRole('button', { name: 'Withdraw request' }).click()
    const dialog = page.getByRole('dialog', { name: 'Withdraw your request?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Keep it' }).click()
    await expect(dialog).toHaveCount(0)
  },
  'farmer.rejected': async (page) => {
    await expect(page.getByRole('alert').filter({ hasText: 'The proof of land ownership is blurry' })).toBeVisible()
    await expect(page.getByText('Replace this')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Send it again' })).toBeVisible()
  },
  'farmer.new': async (page) => {
    await page.getByRole('button', { name: 'Skip for now' }).click() // the sign-in window
    await expect(page.getByRole('heading', { name: 'You’re not in an association yet' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send request' })).toBeDisabled()
  },
}

for (const [handle, check] of Object.entries(STATES)) {
  test(`Association page: ${handle} at 1440 and 390`, async ({ page }) => {
    await signIn(page, handle)
    await page.goto('/dashboard/account/association')
    await expect(page.getByRole('navigation', { name: 'Account settings' }).getByRole('link', { name: 'Association' })).toHaveAttribute('aria-current', 'page')
    await check(page)
    await page.waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 20_000 })
    await page.screenshot({ path: `test-results/c05-association-${handle.split('.')[1]}-1440.png`, fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await noSideScroll(page)).toBe(true)
    await page.screenshot({ path: `test-results/c05-association-${handle.split('.')[1]}-390.png`, fullPage: true })
  })
}

test('Addresses page: map cards, default first, add tile, and the avatar menu link', async ({ page }) => {
  await signIn(page, 'farmer.approved')
  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByRole('menuitem', { name: 'Addresses' }).click()
  await expect(page).toHaveURL('/dashboard/account/addresses')
  await expect(page.getByText('3 of 10')).toBeVisible()
  const cards = page.getByRole('article')
  await expect(cards).toHaveCount(3)
  await expect(cards.first().getByText('Default')).toBeVisible()
  await expect(cards.first().getByText('Farm', { exact: true })).toBeVisible()
  await expect(cards.first().getByText(/km from Kaluppa · ₱/)).toBeVisible()
  await expect(page.getByText('No pin yet', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /^Map of the pin in Pantayin/ })).toBeVisible()
  await page.waitForLoadState('networkidle') // let the map previews draw before the screenshot
  await page.screenshot({ path: 'test-results/c05-addresses-1440.png', fullPage: true })

  // Delete asks first.
  await cards.nth(1).getByRole('button', { name: /^Delete/ }).click()
  await expect(page.getByRole('dialog', { name: 'Delete this address?' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep it' }).click()

  // Add opens the address window, with Farm among the labels.
  await page.getByRole('button', { name: /Add a new address/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Add new address' })
  await expect(dialog.getByRole('button', { name: 'Farm', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await noSideScroll(page)).toBe(true)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/c05-addresses-390.png', fullPage: true })
})

test('guard: a buyer gets no Farm label in the address window', async ({ page }) => {
  await signIn(page, 'buyer')
  await page.goto('/addresses')
  await page.getByRole('button', { name: /Add new address/ }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add new address' })
  await expect(dialog.getByRole('button', { name: 'Home', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Farm', exact: true })).toHaveCount(0)
})
