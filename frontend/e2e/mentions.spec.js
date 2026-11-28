import { expect, test } from '@playwright/test'

// Change 08 Part F: the association map, chatting while pending, and Hub @mentions.
const API = 'http://localhost:5100/api'

async function signIn(page, identifier) {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('KapeKonek@123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
const newPage = async (browser, width = 1440) => (await browser.newContext({ viewport: { width, height: 900 } })).newPage()

test('a farmer with no association picks one from the map; the picker follows', async ({ browser }) => {
  const page = await newPage(browser)
  await signIn(page, 'kapekonek.farmer.new@gmail.com')
  await page.goto('/dashboard/account/association')
  // The join window opens for a farmer with no association; the map is in it and on the page behind it.
  const join = page.getByRole('dialog', { name: 'Join your association' })
  await expect(join.getByText('Or pick one on the map')).toBeVisible()
  await join.getByRole('button', { name: 'Boac Highland Farmers', exact: true }).click()
  await expect(join.getByRole('button', { name: /^Association/ })).toContainText('Boac Highland Farmers')
  await expect(join.getByRole('button', { name: 'Boac Highland Farmers', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(join.getByText('Group Manager: Mario Santos · reviews within a few days')).toBeVisible()
  await page.screenshot({ path: 'test-results/c08-association-map-1440.png' })
  await join.getByRole('button', { name: 'Skip for now' }).click()
  await expect(page.getByRole('region', { name: 'You’re not in an association yet' }).getByText('Or pick one on the map')).toBeVisible()

  const phone = await newPage(browser, 390)
  await signIn(phone, 'kapekonek.farmer.new@gmail.com')
  await phone.goto('/dashboard/account/association')
  await expect(phone.getByRole('dialog', { name: 'Join your association' }).getByText('Or pick one on the map')).toBeVisible()
  expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('a waiting farmer messages their Group Manager from the pending card', async ({ browser }) => {
  const page = await newPage(browser)
  await signIn(page, 'kapekonek.farmer.pending@gmail.com')
  await page.goto('/dashboard/account/association')
  await page.getByRole('link', { name: 'Message Liza' }).click()
  await expect(page).toHaveURL(/\/dashboard\/inbox\/\w+/)
  const text = `Hello po, I sent my papers ${Date.now().toString(36)}`
  await page.getByLabel(/Write a message|Message/).last().fill(text)
  await page.keyboard.press('Enter')
  await expect(page.getByText(text)).toBeVisible()
})

test('a farmer @mentions their Group Manager in a post; she is notified and the name is highlighted', async ({ browser }) => {
  const page = await newPage(browser)
  await signIn(page, 'kapekonek.farmer.approved@gmail.com')
  await page.goto('/dashboard/hub')
  await page.getByRole('region', { name: 'Create a post' }).getByRole('button').first().click()
  const compose = page.getByRole('dialog', { name: 'Create post' })
  const box = compose.getByLabel('Post text')
  const stamp = Date.now().toString(36)
  await box.fill(`Thanks for the leaf rust tips ${stamp} `)
  await compose.getByRole('button', { name: 'Mention someone' }).click()
  await page.keyboard.type('Li')
  const list = compose.getByRole('listbox', { name: 'People you can mention' })
  await expect(list).toContainText('You can mention Kaluppa, your Group Manager and farmers in your association.')
  await expect(list.getByRole('option', { name: /Liza Ramos/ })).toBeVisible()
  await expect(list.getByRole('option', { name: /Felix Rey/ })).toHaveCount(0) // Boac: not in Rodel's association
  await page.screenshot({ path: 'test-results/c08-mention-list-1440.png' })
  await page.keyboard.press('Enter')
  await expect(box).toHaveValue(`Thanks for the leaf rust tips ${stamp} @Liza Ramos `)
  await expect(compose.getByText(/Mentioning @Liza Ramos/)).toBeVisible()
  await compose.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(compose).toHaveCount(0)

  const post = page.getByRole('article').filter({ hasText: stamp })
  await expect(post.getByTitle('Group Manager · Santa Cruz Coffee Growers')).toHaveText(/@Liza Ramos/)

  const liza = await newPage(browser)
  await signIn(liza, 'kapekonek.manager.santacruz@gmail.com')
  const notes = (await (await liza.request.get(`${API}/notifications?limit=5`)).json()).data
  expect(notes.find((n) => n.type === 'mention')).toMatchObject({ title: 'Rodel Mendoza mentioned you in a post' })
})
