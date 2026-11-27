import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { confirmSave } from './helpers/confirm'

// M11 flows (PHASE-2-SPEC §3.9–3.13): needs `npm run migrate:fresh -- --seed`.
const API = 'http://localhost:5100/api'
const RECEIPT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axh0n0AAAAASUVORK5CYII=', 'base64')

async function signIn(page, identifier) {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('KapeKonek@123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
// Kaluppa signs in once per run: the login limiter allows 5 tries a minute per account.
let kaluppaSession
async function asKaluppa(browser, options = {}) {
  if (!kaluppaSession) {
    const context = await browser.newContext()
    await signIn(await context.newPage(), 'kaluppa')
    kaluppaSession = await context.storageState()
    await context.close()
  }
  return (await browser.newContext({ ...options, storageState: kaluppaSession })).newPage()
}
const noSideScroll = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width)

test('a farmer buys fertilizer with GCash; Kaluppa confirms it against the receipt, sends it out and marks it sold', async ({ page, browser }) => {
  await signIn(page, 'farmer.approved')
  await page.goto('/products/organic-fertilizer')
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await expect(page.getByText(/added to your cart/)).toBeVisible()
  await page.getByRole('button', { name: /^Cart, \d+ items?$/ }).click()
  await page.getByRole('dialog', { name: 'Your cart' }).getByRole('button', { name: 'Checkout' }).click()
  await page.getByRole('dialog', { name: 'Continue to checkout?' }).getByRole('button', { name: 'Checkout' }).click()
  await expect(page).toHaveURL('/checkout')
  await expect(page.getByText(/^Delivery fee/).first()).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles({ name: 'gcash-receipt.png', mimeType: 'image/png', buffer: RECEIPT })
  await expect(page.getByText('gcash-receipt.png')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Place order' }).click()
  await page.getByRole('dialog', { name: 'Place this order?' }).getByRole('button', { name: 'Place order' }).click()

  // Farmers land on the order's drawer in their dashboard, not the buyer order page.
  await expect(page).toHaveURL(/\/dashboard\/orders\?.*open=[a-f0-9]{24}/)
  const orderId = new URL(page.url()).searchParams.get('open')
  const mine = page.getByRole('dialog')
  await expect(mine).toContainText('Organic Fertilizer')
  await expect(mine).toContainText('GCash')

  const kaluppa = await asKaluppa(browser)
  await kaluppa.goto(`/dashboard/orders?status=all&open=${orderId}`)
  const drawer = kaluppa.getByRole('dialog')
  await expect(drawer).toContainText('Farmer ·')
  const confirm = drawer.getByRole('button', { name: 'Confirm order' })
  await expect(confirm).toBeDisabled() // the receipt gate
  await drawer.getByLabel('The receipt matches the total').check()
  await confirm.click()
  await drawer.getByRole('button', { name: 'Start processing' }).click()
  const out = drawer.getByRole('button', { name: 'Out for delivery' })
  await expect(out).toBeDisabled() // needs the rider
  await drawer.getByLabel('Rider name').fill('Jun Rider')
  await drawer.getByLabel('Rider phone').fill('0917 555 0123')
  await out.click()
  await drawer.getByRole('button', { name: 'Mark sold' }).click()
  await expect(drawer).toContainText('Completed')

  await page.reload()
  await expect(page.getByRole('dialog')).toContainText('Completed')
})

test('Kaluppa picks a new thumbnail for a product, and the store shows it first', async ({ browser }) => {
  const page = await asKaluppa(browser)
  await page.goto('/dashboard/inventory?q=Barako')
  await page.getByRole('button', { name: /^Edit Barako/ }).first().click()
  const form = page.getByRole('dialog', { name: /^Edit Barako/ })
  const src = await form.getByRole('img', { name: 'Photo 2', exact: true }).getAttribute('src')
  await form.getByRole('button', { name: 'Make photo 2 the thumbnail' }).click()
  await expect(form.getByRole('button', { name: 'Photo 2 is the thumbnail' })).toHaveAttribute('aria-pressed', 'true')
  await form.getByRole('button', { name: 'Save changes' }).click()
  await confirmSave(page)
  await expect(form).toBeHidden()
  const [product] = (await (await page.request.get(`${API}/admin/products?q=Barako&limit=1`)).json()).data
  const publicId = src.split('/upload/')[1].split('/').slice(1).join('/').replace(/\.\w+$/, '')
  // The store reads the thumbnail first (cards, cart, orders).
  const store = (await (await page.request.get(`${API}/products/${product.slug}`)).json()).data
  expect(store.images[0].url).toContain(publicId)
})

test('Kaluppa replies to a review and the reply shows under it on the product page', async ({ browser }) => {
  const page = await asKaluppa(browser)
  const [review] = (await (await page.request.get(`${API}/admin/reviews?reply=needs&limit=1`)).json()).data
  const text = `Salamat po! E2E ${Date.now().toString(36)}`
  await page.goto(`/dashboard/reviews?open=${review._id ?? review.id}`)
  const drawer = page.getByRole('dialog')
  await drawer.getByLabel(/Public reply/).fill(text)
  await drawer.getByRole('button', { name: 'Save reply' }).click()
  await expect(drawer.getByText(text)).toBeVisible()

  // Kaluppa is sent to the dashboard from the store, so look as a guest.
  const guest = await (await browser.newContext()).newPage()
  await guest.goto(`/products/${review.product.slug}`)
  await expect(guest.getByText(text)).toBeVisible()
  await expect(guest.getByText('Reply from Kaluppa').first()).toBeVisible()
})

test('Kaluppa opens Sunday in Settings; the save bar appears on change and the pickup card follows', async ({ browser }) => {
  const page = await asKaluppa(browser)
  await page.goto('/dashboard/settings')
  const sunday = page.getByRole('switch', { name: 'Open on Sunday' })
  await expect(page.getByText('You have unsaved changes.')).toBeHidden()
  const wasOpen = (await sunday.getAttribute('aria-checked')) === 'true'
  await sunday.click()
  await expect(page.getByText('You have unsaved changes.')).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await confirmSave(page)
  await expect(page.getByText('Settings saved. New quotes use the updated values.')).toBeVisible()
  const { pickup } = (await (await page.request.get(`${API}/delivery/info`)).json()).data
  expect(pickup.hours.includes('Sun')).toBe(!wasOpen)

  // Put it back, then check the other tabs: Try it works on the rules on screen.
  await sunday.click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await confirmSave(page)
  await expect(page.getByText('You have unsaved changes.')).toBeHidden()
  await page.getByRole('tab', { name: 'Delivery fee' }).click()
  await page.getByLabel('Road distance (km)').fill('100')
  await expect(page.getByText('Outside the area')).toBeVisible()
  await page.getByRole('tab', { name: 'E-wallet' }).click()
  await expect(page.getByRole('region', { name: 'GCash' })).toBeVisible()
})

test.describe('at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('the farmer orders page and Kaluppa’s M11 pages fit without side scrolling', async ({ page, browser }) => {
    await signIn(page, 'farmer.approved')
    await page.goto('/dashboard/orders')
    await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible()
    await noSideScroll(page)

    const kaluppa = await asKaluppa(browser, { viewport: { width: 390, height: 844 } })
    for (const [path, heading] of [['/dashboard/orders', 'Orders'], ['/dashboard/inventory', 'Inventory'], ['/dashboard/reviews', 'Reviews'], ['/dashboard/settings', 'Settings']]) {
      await kaluppa.goto(path)
      await expect(kaluppa.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      await noSideScroll(kaluppa)
    }
  })
})
