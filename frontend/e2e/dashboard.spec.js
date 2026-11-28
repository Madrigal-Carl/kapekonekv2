import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { latestMailLink } from './helpers/mailbox.js'

// M8 flows (PHASE-2-SPEC §3): needs `npm run migrate:fresh -- --seed` (Santa Cruz Coffee Growers run by manager.santacruz).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axh0n0AAAAASUVORK5CYII=', 'base64')
const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}



test('farmer signs up → verifies → joins through the window → Group Manager approves', async ({ page, browser }) => {
  const id = unique()
  const email = `e2e.farmer.${id}@example.com`
  await page.goto('/register')
  await page.getByLabel('Sell as a farmer').check()
  await page.getByLabel('First name').fill('Fe')
  await page.getByLabel('Last name').fill(`Farmer${id}`)
  await page.getByLabel('Username').fill(`fe${id}`)
  await page.getByLabel('Contact number').fill('09171234501')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('KapeKonek@123')
  await page.getByLabel('Confirm password').fill('KapeKonek@123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/verify-email')

  const link = new URL(await latestMailLink(email, '/verify-email/confirm'))
  await page.goto(link.pathname + link.search)
  await expect(page).toHaveURL('/dashboard/overview')

  const window = page.getByRole('dialog', { name: 'Join your association' })
  await expect(window).toBeVisible()
  const send = window.getByRole('button', { name: 'Send request' })
  await expect(send).toBeDisabled()
  await window.getByRole('button', { name: /Association/ }).click()
  await page.getByRole('option', { name: /Santa Cruz Coffee Growers/ }).click()
  await expect(window.getByText('Group Manager: Liza Ramos · reviews within a few days')).toBeVisible()
  await window.getByLabel('Upload valid ID').setInputFiles({ name: 'valid-id.png', mimeType: 'image/png', buffer: PNG })
  await window.getByLabel('Upload proof of land ownership').setInputFiles({ name: 'land-proof.png', mimeType: 'image/png', buffer: PNG })
  await expect(window.getByText('land-proof.png')).toBeVisible({ timeout: 30_000 })
  await expect(send).toBeEnabled()
  await send.click()
  await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible()
  await page.getByRole('button', { name: 'Go to my dashboard' }).click()
  await expect(page.getByText('Your request is with Santa Cruz Coffee Growers')).toBeVisible()

  const manager = await browser.newPage()
  await signIn(manager, 'manager.santacruz')
  await manager.goto('/dashboard/farmers?status=pending')
  await manager.getByRole('button', { name: `Review Fe Farmer${id}` }).click()
  const review = manager.getByRole('dialog', { name: 'Review Fe’s request' })
  await expect(review.getByRole('img', { name: 'Valid ID preview' })).toBeVisible()
  await review.getByRole('button', { name: 'Approve farmer' }).click()
  await expect(manager.getByText(`Fe Farmer${id} is approved and can now sell without a limit.`)).toBeVisible()
  await manager.close()

  await page.reload()
  await expect(page.locator('aside').getByText('Approved farmer')).toBeVisible()
})

test('Group Manager adds a farmer with the default password; they verify first, then can be reset (Change 08)', async ({ page, browser }) => {
  const id = unique()
  const email = `e2e.farmer.${id}@example.com`
  await signIn(page, 'manager.santacruz')
  await page.goto('/dashboard/farmers')
  await page.getByRole('button', { name: 'Add farmer' }).click()
  await page.getByLabel('First name').fill('Nilo')
  await page.getByLabel('Last name').fill(`Farmer${id}`)
  // Suggestions are built from the name; picking one fills the field.
  const chip = page.getByRole('button', { name: /^@nilo/ }).first()
  const username = (await chip.textContent()).slice(1)
  await chip.click()
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(username)
  await expect(page.getByText(`@${username} is available`)).toBeVisible()
  await page.getByLabel('Contact number').fill('09171112233')
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('KapeKonek@123')
  await expect(page.getByLabel('Password', { exact: true })).not.toBeEditable()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.screenshot({ path: 'test-results/c08-farmer-create-1440.png' })
  await page.getByRole('button', { name: 'Create farmer' }).click()
  await expect(page.getByText(`Nilo Farmer${id} is added. We emailed them a link to verify their email.`)).toBeVisible()

  // Guard: until the email is verified, every sign-in lands on Verify email (created variant).
  const farmer = await browser.newPage()
  await signIn(farmer, username, 'KapeKonek@123')
  await expect(farmer).toHaveURL('/verify-email')
  await expect(farmer.getByText('Liza Ramos created a farmer account for you in Santa Cruz Coffee Growers. Verify your email before you can use it.')).toBeVisible()
  await farmer.goto('/dashboard/overview')
  await expect(farmer).toHaveURL('/verify-email')
  await farmer.screenshot({ path: 'test-results/c08-verify-created-1440.png' })
  const link = new URL(await latestMailLink(email, '/verify-email/confirm'))
  await farmer.goto(link.pathname + link.search)
  await expect(farmer).toHaveURL('/dashboard/overview')
  await expect(farmer.getByText('You’re still using the default password.')).toBeVisible()

  // Reset password on edit: confirm, then the farmer's session ends.
  await page.getByRole('searchbox').fill(`Farmer${id}`)
  await page.getByRole('button', { name: `Edit Nilo Farmer${id}` }).click()
  await page.getByRole('button', { name: 'Reset password' }).click()
  const modal = page.getByRole('dialog', { name: 'Reset Nilo’s password?' })
  await expect(modal).toContainText('They’re signed out on every device')
  await modal.getByRole('button', { name: 'Reset password' }).click()
  await expect(page.getByText('Nilo’s password is back to the default. We emailed them.')).toBeVisible()
  await farmer.reload()
  await expect(farmer).toHaveURL(/\/login/)
  await farmer.close()
})

test('Kaluppa creates and archives a Group Manager', async ({ page }) => {
  const id = unique()
  await signIn(page, 'kaluppa')
  await page.goto('/dashboard/group-managers')
  await page.getByRole('button', { name: 'Add Group Manager' }).click()
  await page.getByLabel('First name').fill('Gail')
  await page.getByLabel('Last name').fill(`Manager${id}`)
  await page.getByLabel('Contact number').fill('09171112244')
  await page.getByLabel('Email', { exact: true }).fill(`e2e.gm.${id}@example.com`)
  // A taken username blocks saving; a suggestion fixes it.
  const username = page.getByLabel('Username', { exact: true })
  await username.fill('manager.santacruz')
  await expect(page.getByText('@manager.santacruz is taken. Try a suggestion.')).toBeVisible()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('dialog', { name: 'Add a Group Manager' })).toBeVisible()
  await page.screenshot({ path: 'test-results/c05-gm-username-taken-1440.png' })
  const chip = page.getByRole('button', { name: /^@gail/ }).first()
  const picked = (await chip.textContent()).slice(1)
  await chip.click()
  await expect(username).toHaveValue(picked)
  await expect(page.getByText(`@${picked} is available`)).toBeVisible()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Account created. We emailed them a link to verify their email.')).toBeVisible()

  await page.getByRole('searchbox').fill(`Manager${id}`)
  await page.getByRole('button', { name: `Archive Gail Manager${id}` }).click()
  await page.getByRole('button', { name: 'Archive account' }).click()
  await expect(page.getByText(`Gail Manager${id} was archived.`)).toBeVisible()
  await expect(page.getByRole('button', { name: `Restore Gail Manager${id}` })).toBeVisible()
})

test('guard: a Group Manager can’t open Group Managers', async ({ page }) => {
  await signIn(page, 'manager.santacruz')
  await page.goto('/dashboard/group-managers')
  await expect(page.getByRole('heading', { name: 'You can\'t open this page' })).toBeVisible()
})

// Each M8 page per role, at desktop and phone width: it renders and never scrolls sideways.
const PAGES = {
  kaluppa: ['/dashboard/overview', '/dashboard/farmers', '/dashboard/group-managers', '/dashboard/associations', '/dashboard/account/profile', '/dashboard/account/security'],
  'manager.santacruz': ['/dashboard/overview', '/dashboard/farmers', '/dashboard/account/profile'],
  'farmer.approved': ['/dashboard/overview', '/dashboard/account/association', '/dashboard/account/addresses'],
}
for (const [handle, paths] of Object.entries(PAGES)) {
  test(`${handle}: pages fit at 1440 and 390`, async ({ page }) => {
    await signIn(page, handle)
    await expect(page).toHaveURL('/dashboard/overview')
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of paths) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.getByRole('alert').filter({ hasText: 'couldn’t' })).toHaveCount(0)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0)
      }
    }
  })
}
