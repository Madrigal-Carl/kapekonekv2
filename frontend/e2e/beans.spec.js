import { expect, test } from '@playwright/test'

// M10 flows (PHASE-2-SPEC §3.5): needs a fresh `npm run migrate:fresh -- --seed` (beans seeder: farmer.pending at 3 of 5 kg;
// pending listings from Joy, Rodel and Felix; approved ones from Rodel, expiring within a day, and Nestor).
// Creating and editing a listing use Mongo transactions, so the database must be a replica set (Atlas is).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axh0n0AAAAASUVORK5CYII=', 'base64')

async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
const pick = async (page, scope, field, option) => {
  await scope.getByRole('button', { name: field }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('unapproved farmer sees 3 of 5 kg used, and Send stays off above the 2 kg left', async ({ page }) => {
  await signIn(page, 'farmer.pending')
  await page.goto('/dashboard/beans')
  await expect(page.getByRole('heading', { name: 'Sell beans to Kaluppa' })).toBeVisible()
  const limit = page.getByRole('region', { name: 'Selling limit' })
  await expect(limit).toContainText('3 kg of 5 kg used')
  await expect(limit).toContainText('2 kg left')

  await page.getByRole('button', { name: 'Sell beans' }).click()
  const drawer = page.getByRole('dialog', { name: 'List beans for Kaluppa' })
  await expect(drawer.getByRole('button', { name: /^Farmer/ })).toHaveCount(0)
  await pick(page, drawer, /^Variety/, 'Liberica')
  await pick(page, drawer, /^Form/, 'Dried cherry')
  await drawer.getByLabel('Weight (kg)').fill('2.5')
  await drawer.getByLabel('Your price per kg (₱)').fill('180')
  await expect(drawer.getByText('Over your limit. You can list up to 2 kg more until you’re approved.')).toBeVisible()
  await expect(drawer.getByText('₱450')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send to Kaluppa' })).toBeDisabled()
  await drawer.getByLabel('Weight (kg)').fill('2')
  await expect(drawer.getByText('You can list up to 2 kg more until you’re approved.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send to Kaluppa' })).toBeEnabled()
  await page.screenshot({ path: 'test-results/beans/farmer-sell-1440.png' })
})

// Dario (unapproved, nothing listed yet) so Joy's seeded 3 of 5 kg stays as the other tests expect.
test('unapproved farmer lists 1.5 kg with a photo, then edits it to 2 kg', async ({ page }) => {
  await signIn(page, 'dario.lopez')
  await page.goto('/dashboard/beans')
  await page.getByRole('button', { name: 'Sell beans' }).click()
  const drawer = page.getByRole('dialog', { name: 'List beans for Kaluppa' })
  await pick(page, drawer, /^Variety/, 'Excelsa')
  await pick(page, drawer, /^Form/, 'Parchment')
  await drawer.getByLabel('Weight (kg)').fill('1.5')
  await drawer.getByLabel('Your price per kg (₱)').fill('240')
  await drawer.locator('input[type="file"]').setInputFiles({ name: 'beans.png', mimeType: 'image/png', buffer: PNG })
  await expect(drawer.getByRole('img', { name: 'Photo 1' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Send to Kaluppa' }).click()
  await expect(page.getByText('Listing sent. Kaluppa will review it soon.')).toBeVisible()

  const row = page.getByRole('row', { name: /Excelsa Parchment 1\.5 kg/ })
  await expect(row).toContainText('Waiting for review')
  await expect(page.getByRole('region', { name: 'Selling limit' })).toContainText('3.5 kg left')
  await row.getByRole('button', { name: /^Edit BN-/ }).click()
  const edit = page.getByRole('dialog', { name: /^Edit BN-\d{4}-\d{4}$/ })
  await expect(edit.getByLabel('Weight (kg)')).toHaveValue('1.5')
  await expect(edit.getByText('You can list up to 5 kg more until you’re approved.')).toBeVisible() // its own 1.5 kg counts back
  await edit.getByLabel('Weight (kg)').fill('2')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Listing updated.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Selling limit' })).toContainText('3 kg left')
  await expect(page.getByRole('row', { name: /Excelsa Parchment 2 kg/ })).toBeVisible()
})

// Change 07 (BeansLimit): Dario is at 2 kg after the test above.
test('at 5 kg Sell beans is disabled; the Group Manager can’t pick that farmer; a cancel unlocks it', async ({ browser }) => {
  const page = await browser.newPage()
  await signIn(page, 'dario.lopez')
  await page.goto('/dashboard/beans')
  await page.getByRole('button', { name: 'Sell beans' }).click()
  const drawer = page.getByRole('dialog', { name: 'List beans for Kaluppa' })
  await pick(page, drawer, /^Variety/, 'Robusta')
  await pick(page, drawer, /^Form/, 'Dried cherry')
  await drawer.getByLabel('Weight (kg)').fill('3')
  await drawer.getByLabel('Your price per kg (₱)').fill('120')
  await drawer.locator('input[type="file"]').setInputFiles({ name: 'beans.png', mimeType: 'image/png', buffer: PNG })
  await expect(drawer.getByRole('img', { name: 'Photo 1' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Send to Kaluppa' }).click()
  await expect(page.getByText('Listing sent. Kaluppa will review it soon.')).toBeVisible()

  const sell = page.getByRole('button', { name: 'Sell beans' })
  await expect(sell).toBeDisabled()
  await expect(sell).toHaveAccessibleDescription('You’ve used your 5 kg limit')
  await expect(page.getByRole('region', { name: 'Selling limit' })).toContainText('You’ve reached your 5 kg limit.')
  await page.screenshot({ path: 'test-results/beans/farmer-limit-1440.png' })

  const manager = await browser.newPage()
  await signIn(manager, 'manager.santacruz')
  await manager.goto('/dashboard/beans')
  await manager.getByRole('button', { name: 'Sell beans' }).click()
  await manager.getByRole('dialog', { name: 'List beans for Kaluppa' }).getByRole('button', { name: /^Farmer/ }).click()
  const dario = manager.getByRole('option', { name: /^Dario Lopez/ })
  await expect(dario).toHaveAttribute('aria-disabled', 'true')
  await expect(dario).toContainText('limit reached')
  await manager.close()

  await page.getByRole('button', { name: /^View BN-/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel listing' }).click()
  await page.getByRole('dialog', { name: 'Cancel this listing?' }).getByRole('button', { name: 'Cancel listing' }).click()
  await expect(page.getByText(/was cancelled\./)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sell beans' })).toBeEnabled()
  await page.close()
})

test('approved farmer sees the deadline, the branch hours and phone on an approved listing', async ({ page }) => {
  await signIn(page, 'farmer.approved')
  await page.goto('/dashboard/beans?status=approved')
  await expect(page.getByRole('region', { name: 'Selling limit' })).toHaveCount(0)
  await page.getByRole('button', { name: /^View BN-/ }).first().click()
  const view = page.getByRole('dialog', { name: '25 kg Liberica, dried cherry' })
  await expect(view.getByText(/^Approved · bring your beans by /)).toBeVisible()
  await expect(view.getByText('Kaluppa branch', { exact: true })).toBeVisible()
  await expect(view.getByText(/0917 800 1122/)).toBeVisible()
  await expect(view.getByRole('button', { name: 'Cancel listing' })).toBeVisible()
  await page.screenshot({ path: 'test-results/beans/farmer-view-approved-1440.png' })
})

test('Group Manager picks the farmer first and sees that farmer’s limit', async ({ page }) => {
  await signIn(page, 'manager.santacruz')
  await page.goto('/dashboard/beans')
  await expect(page.getByRole('heading', { name: 'Beans from your farmers' })).toBeVisible()
  await page.getByRole('button', { name: 'Sell beans' }).click()
  const drawer = page.getByRole('dialog', { name: 'List beans for Kaluppa' })
  await pick(page, drawer, /^Farmer/, 'Joy Lacsamana · unapproved, 2 kg left')
  await drawer.getByLabel('Weight (kg)').fill('3')
  await expect(drawer.getByText('Over your limit. Joy can list up to 2 kg more until approved.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send to Kaluppa' })).toBeDisabled()
})

test('Kaluppa approves, completes, rejects with a reason and cancels a sale', async ({ page }) => {
  await signIn(page, 'kaluppa')
  await page.goto('/dashboard/beans')
  await expect(page.getByRole('heading', { name: 'Beans from farmers' })).toBeVisible()
  // The To review tile counts what the default To review list shows.
  const shown = (await page.getByText(/^Showing 1–\d+ of \d+$/).textContent()).match(/of (\d+)/)[1]
  await expect(page.getByRole('list', { name: 'Bean summary' })).toContainText(`To review${shown}`)
  await page.screenshot({ path: 'test-results/beans/kaluppa-list-1440.png', fullPage: true })

  // Approve Rodel's 30 kg, then complete it with the weight from the branch.
  await page.getByRole('row', { name: /Rodel Mendoza/ }).getByRole('button', { name: /^Review BN-/ }).click()
  let drawer = page.getByRole('dialog', { name: '30 kg Excelsa, parchment' })
  await expect(drawer.getByText('Approved farmer')).toBeVisible()
  // The photo loads inside the fixed 16:10 stage.
  const stage = drawer.getByRole('img', { name: /^Bean photo 1 of / })
  await expect.poll(() => stage.evaluate((img) => img.complete && img.naturalWidth), { timeout: 15_000 }).toBeGreaterThan(0)
  const box = await stage.evaluate((img) => img.parentElement.getBoundingClientRect())
  expect(Math.round((box.width / box.height) * 10)).toBe(16)
  await page.screenshot({ path: 'test-results/beans/kaluppa-review-1440.png' })
  await drawer.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText(/^BN-\d{4}-\d{4} approved\. Rodel has 7 days to bring the beans\.$/)).toBeVisible()

  await page.goto('/dashboard/beans?status=approved&q=Excelsa')
  await page.getByRole('row', { name: /Rodel Mendoza/ }).getByRole('button', { name: /^View BN-/ }).click()
  drawer = page.getByRole('dialog', { name: '30 kg Excelsa, parchment' })
  await drawer.getByRole('button', { name: 'Beans arrived' }).click()
  await drawer.getByLabel('Final weight (kg)').fill('29.5')
  await drawer.getByLabel('Final amount (₱)').fill('7080')
  await expect(drawer.getByText('Listed: 30 kg for ₱7,200. Both values are kept.')).toBeVisible()
  await drawer.getByRole('button', { name: 'Mark completed' }).click()
  await expect(page.getByText(/^BN-\d{4}-\d{4} completed\.$/)).toBeVisible()

  // Reject Joy's listing: the reason needs 5 or more characters.
  await page.goto('/dashboard/beans?q=Joy')
  await page.getByRole('row', { name: /Joy Lacsamana.*Liberica/ }).getByRole('button', { name: /^Review BN-/ }).click()
  drawer = page.getByRole('dialog', { name: '2 kg Liberica, dried cherry' })
  await expect(drawer.getByText('Within 5 kg limit')).toBeVisible()
  await drawer.getByRole('button', { name: 'Reject' }).click()
  await drawer.getByLabel('Reason · required').fill('wet')
  await drawer.getByRole('button', { name: 'Reject listing' }).click()
  await expect(drawer.getByText('Tell us a little more (at least 5 characters)')).toBeVisible()
  await drawer.getByLabel('Reason · required').fill('Moisture too high for storage. Dry for 3 more days and list again.')
  await drawer.getByRole('button', { name: 'Reject listing' }).click()
  await expect(page.getByText(/^BN-\d{4}-\d{4} rejected\. The farmer was told your reason\.$/)).toBeVisible()

  // Cancel Nestor's approved sale, with a reason.
  await page.goto('/dashboard/beans?status=approved&q=Nestor')
  await page.getByRole('row', { name: /Nestor Perez/ }).getByRole('button', { name: /^View BN-/ }).click()
  await page.getByRole('dialog', { name: '50 kg Robusta, green beans' }).getByRole('button', { name: 'Cancel sale' }).click()
  const modal = page.getByRole('dialog', { name: 'Cancel this sale?' })
  await expect(modal).toContainText('was approved but the beans haven’t arrived. Nestor gets an email.')
  await modal.getByRole('textbox').fill('Not brought within the agreed date')
  await modal.getByRole('button', { name: 'Cancel sale' }).click()
  await expect(page.getByText('Sale cancelled.')).toBeVisible()
})

test('guard: a buyer opening the Beans page gets the 403 page', async ({ page }) => {
  await signIn(page, 'buyer')
  await page.goto('/dashboard/beans')
  await expect(page.getByRole('heading', { name: 'You can\'t open this page' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sell beans' })).toHaveCount(0)
})

// The Beans page per role, at desktop and phone width: it renders, loads, and never scrolls sideways.
for (const handle of ['kaluppa', 'manager.santacruz', 'farmer.approved', 'farmer.pending']) {
  test(`${handle}: Beans page fits at 1440 and 390`, async ({ page }) => {
    await signIn(page, handle)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/dashboard/beans')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText(/couldn’t load/)).toHaveCount(0)
      await expect(page.getByText(/^BN-\d{4}-\d{4}$/).first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `beans at ${width}px`).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `test-results/beans/${handle}-${width}.png`, fullPage: true })
    }
  })
}
