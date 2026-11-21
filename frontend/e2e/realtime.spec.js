import { expect, request, test } from '@playwright/test'

const API = 'http://localhost:5100/api'

async function signIn(page, identifier) {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
}

/** Place a cash-on-delivery order to the buyer's default address through the API (the browser's cookies). */
async function placeDeliveryOrder(api) {
  const product = (await (await api.get(`${API}/products/robusta-dark-roast`)).json()).data
  expect((await api.post(`${API}/cart/items`, { data: { productId: product._id, quantity: 1 } })).ok()).toBe(true)
  const address = (await (await api.get(`${API}/addresses`)).json()).data.find((a) => a.isDefault)
  const placed = await api.post(`${API}/orders`, { data: { method: 'delivery', addressId: address._id, paymentMethod: 'cash' } })
  expect(placed.status()).toBe(201)
  return (await placed.json()).data
}

test('live: Kaluppa moves the order to out for delivery and the bell and banner update without a reload', async ({ page }) => {
  await signIn(page, 'buyer05@kapekonek.test')
  await page.request.patch(`${API}/notifications/read-all`)
  const order = await placeDeliveryOrder(page.request)

  await page.goto(`/orders/${order._id}`)
  const banner = page.getByRole('status')
  await expect(banner).toContainText('Waiting for Kaluppa to confirm')
  await expect(page.getByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible()
  await page.evaluate(() => {
    window.__sameDocument = true
  })

  const kaluppa = await request.newContext()
  expect((await kaluppa.post(`${API}/auth/login`, { data: { identifier: 'kaluppa@kapekonek.test', password: 'Password123!' } })).ok()).toBe(true)
  const move = (body) => kaluppa.patch(`${API}/orders/${order._id}/status`, { data: body })
  expect((await move({ status: 'reserved' })).ok()).toBe(true)
  expect((await move({ status: 'processing' })).ok()).toBe(true)
  expect((await move({ status: 'out_for_delivery', rider: { name: 'Jun R.', phone: '09175550102' } })).ok()).toBe(true)

  await expect(banner).toContainText('Your order is on the way')
  await expect(banner).toContainText('Rider: Jun R. · 0917 555 0102')
  await expect(page.getByText('Out for delivery', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notifications, 4 unread' })).toBeVisible()
  expect(await page.evaluate(() => window.__sameDocument)).toBe(true)

  // The bell lists the newest first; "Mark all as read" clears the count.
  await page.getByRole('button', { name: 'Notifications, 4 unread' }).click()
  const panel = page.getByRole('region', { name: 'Notifications', exact: true })
  await expect(panel.getByRole('listitem').first()).toContainText(`Order ${order.orderNumber} is on the way`)
  await panel.getByRole('button', { name: 'Mark all as read' }).click()
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  // Tidy up: complete the order so buyer05's list doesn't fill with open orders.
  await move({ status: 'sold' })
  await kaluppa.dispose()
})
