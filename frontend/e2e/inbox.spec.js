import { expect, test } from '@playwright/test'

async function signIn(page, identifier) {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('KapeKonek@123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
const noSideScroll = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width)
const chatRow = (page, name) => page.getByRole('list', { name: 'Chats' }).getByRole('button', { name: new RegExp(name) })

test('live at 1440: Nestor types and writes to Rodel; Rodel sees it without a reload and Nestor sees "Seen"', async ({ browser }) => {
  const rodel = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  const nestor = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await signIn(rodel, 'kapekonek.farmer.approved@gmail.com')
  await signIn(nestor, 'kapekonek.nestor.perez@gmail.com')

  // Seeded: the Santa Cruz group shows the edited and deleted messages, and the Boac group is read-only.
  await rodel.goto('/dashboard/inbox')
  await chatRow(rodel, 'Santa Cruz Coffee Growers').click()
  const groupLog = rodel.getByRole('log', { name: /Messages with Santa Cruz/ })
  await expect(groupLog).toContainText('This message was deleted')
  await expect(groupLog).toContainText('· Edited')
  await chatRow(rodel, 'Boac Highland Farmers').click()
  await expect(rodel.getByRole('note')).toContainText('This chat is read-only')
  await expect(rodel.getByLabel('Message', { exact: true })).toHaveCount(0)

  await chatRow(rodel, 'Nestor Perez').click()
  await expect(rodel.getByRole('log', { name: 'Messages with Nestor Perez' })).toContainText('Planting them this weekend')

  await nestor.goto('/dashboard/inbox')
  await chatRow(nestor, 'Rodel').click()
  const text = `Rain tomorrow, cover the beans ${Date.now()}`
  await nestor.getByLabel('Message', { exact: true }).pressSequentially('Rain', { delay: 30 })
  await expect(rodel.getByText('Nestor is typing…')).toBeVisible()
  await nestor.getByLabel('Message', { exact: true }).fill(text)
  await nestor.getByLabel('Message', { exact: true }).press('Enter')

  await expect(rodel.getByRole('log', { name: 'Messages with Nestor Perez' })).toContainText(text)
  await expect(nestor.getByRole('log').getByText('Seen', { exact: true })).toBeVisible()
  await noSideScroll(rodel)
})

test('phone at 390: the list, then the chat full screen with Back', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
  await signIn(page, 'kapekonek.farmer.approved@gmail.com')
  await page.goto('/dashboard/inbox')
  await expect(page).toHaveURL('/dashboard/inbox') // a phone does not auto-open a chat
  await chatRow(page, 'Kaluppa').click()
  const log = page.getByRole('log', { name: 'Messages with Kaluppa' })
  await expect(log).toContainText('Your 30 kg listing is approved')
  await expect(page.getByRole('list', { name: 'Chats' })).toBeHidden()
  await noSideScroll(page)
  await page.getByRole('button', { name: 'Back to chats' }).click()
  await expect(page.getByRole('list', { name: 'Chats' })).toBeVisible()
})

test('guard: a buyer cannot open the Inbox', async ({ page }) => {
  await signIn(page, 'kapekonek.buyer@gmail.com')
  await page.goto('/dashboard/inbox')
  await expect(page.getByText('Error 403')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Chats' })).toHaveCount(0)
})
