import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

// 1×1 PNG used as the GCash receipt.
const RECEIPT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axh0n0AAAAASUVORK5CYII=', 'base64')

async function signIn(page, identifier, redirect = '/') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(redirect)
}

/** Add one product from its page, then open the cart and confirm checkout. */
async function addAndCheckout(page, slug) {
  await page.goto(`/products/${slug}`)
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await expect(page.getByText(/added to your cart/)).toBeVisible()
  await page.getByRole('button', { name: /^Cart, \d+ items$/ }).click()
  const drawer = page.getByRole('dialog', { name: 'Your cart' })
  await drawer.getByRole('button', { name: 'Checkout' }).click()
  await page.getByRole('dialog', { name: 'Continue to checkout?' }).getByRole('button', { name: 'Checkout' }).click()
  await expect(page).toHaveURL('/checkout')
}

async function placeOrder(page) {
  await page.getByRole('button', { name: 'Place order' }).click()
  const confirm = page.getByRole('dialog', { name: 'Place this order?' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Place order' }).click()
  await expect(page).toHaveURL(/\/orders\/[a-f0-9]{24}$/)
}

test('delivery: pin a new address, check out with cash on delivery, then cancel with a reason', async ({ page }) => {
  const street = `E2E Lot ${Date.now() % 1000}, near the plaza`
  await signIn(page, 'buyer03@kapekonek.test', '/addresses')

  await page.getByRole('button', { name: 'Add new address' }).first().click()
  const modal = page.getByRole('dialog', { name: 'Add new address' })
  const map = modal.locator('canvas.mapboxgl-canvas')
  await expect(map).toBeVisible({ timeout: 20_000 })
  await map.click() // the map opens centred on Marinduque
  await expect(modal.getByText(/^Pin at 13\.\d{4}, 12[12]\.\d{4}/)).toBeVisible({ timeout: 15_000 })
  await expect(modal.getByRole('button', { name: /^Municipality/ })).not.toContainText('Select municipality')
  const barangay = modal.getByRole('button', { name: /^Barangay/ })
  if ((await barangay.textContent()).includes('Select barangay')) {
    await barangay.click()
    await page.getByRole('option').first().click()
  }
  await modal.getByLabel('Street, house no., landmark').fill(street)
  await expect(modal.getByText(/by road from Kaluppa · delivery fee/)).toBeVisible({ timeout: 15_000 })
  await modal.getByRole('button', { name: 'Save address' }).click()
  await expect(modal).toBeHidden()
  await expect(page.getByText(street)).toBeVisible()

  await addAndCheckout(page, 'robusta-dark-roast')
  await page.locator('label').filter({ hasText: street }).getByRole('radio').check()
  await page.getByRole('radio', { name: /Cash on delivery/ }).check()
  await expect(page.getByText(/Please prepare ₱[\d,.]+ in cash for the rider/)).toBeVisible()
  await placeOrder(page)
  await expect(page.getByText('Pending', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Waiting for Kaluppa to confirm')

  await page.getByRole('button', { name: 'Cancel order' }).click()
  const cancel = page.getByRole('dialog', { name: 'Cancel this order?' })
  await cancel.getByLabel('Ordered by mistake').check()
  await cancel.getByRole('button', { name: 'Cancel order' }).click()
  await expect(cancel).toBeHidden()
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Refund pending|Refunded/)).toHaveCount(0)

  // Tidy up: delete the address again (confirmation required).
  await page.goto('/addresses')
  await page.getByRole('listitem').filter({ hasText: street }).getByRole('button', { name: /^Delete / }).click()
  await page.getByRole('dialog', { name: 'Delete this address?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText(street)).toHaveCount(0)
})

test('pickup: GCash with an uploaded receipt is placed as pending', async ({ page }) => {
  await signIn(page, 'buyer04@kapekonek.test')
  await addAndCheckout(page, 'barako-medium-roast')
  await page.getByRole('radio', { name: /Pick up at Kaluppa/ }).check()
  await page.getByLabel('Contact number').fill('0917 555 0199')
  await expect(page.getByRole('radio', { name: /GCash or Maya/ })).toBeChecked()
  await expect(page.getByRole('img', { name: 'Sample GCash QR code' })).toBeVisible()
  // A 6 MB image is stopped in the browser before anything uploads.
  await page.locator('input[type="file"]').setInputFiles({ name: 'big-receipt.png', mimeType: 'image/png', buffer: Buffer.alloc(6 * 1024 * 1024, 1) })
  await expect(page.getByRole('alert').filter({ hasText: 'big-receipt.png is 6.0 MB.' })).toContainText('Images can be up to 5 MB.')
  await page.locator('input[type="file"]').setInputFiles({ name: 'gcash-receipt.png', mimeType: 'image/png', buffer: RECEIPT })
  await expect(page.getByText('gcash-receipt.png')).toBeVisible({ timeout: 30_000 })
  await placeOrder(page)
  await expect(page.getByText('Pending', { exact: true })).toBeVisible()
  await expect(page.getByText('GCash · ', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /View receipt/ })).toBeVisible()
})

test('guard: an unverified buyer opening /checkout is sent to verify their email', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill('buyer.unverified@kapekonek.test')
  await page.getByLabel('Password', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/verify-email')
  await page.goto('/checkout')
  await expect(page).toHaveURL('/verify-email')
})
