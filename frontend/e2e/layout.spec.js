import { expect, test } from '@playwright/test'

// Change 07 / DESIGN §8.7: sticky top bar, full-width Inbox and Hub with a sticky Hub aside, 2 × 2 Reports.
async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
const topOf = (locator) => locator.evaluate((el) => el.getBoundingClientRect().top)

for (const width of [1440, 390]) {
  test(`top bar stays put on a long page at ${width}px; a drawer covers it`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await signIn(page, 'kaluppa')
    await page.goto('/dashboard/audit-log')
    const view = page.getByRole('button', { name: /^View / })
    await expect(view.first()).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
    const bar = page.locator('[data-sticky-bar]')
    expect(await topOf(bar)).toBe(0)
    await view.last().click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    // The drawer is on top: the point in the bar's middle belongs to the drawer or its backdrop.
    const box = await bar.boundingBox()
    expect(await page.evaluate(([x, y]) => !document.elementFromPoint(x, y).closest('[data-sticky-bar]'), [box.x + box.width - 30, box.y + 30])).toBe(true)
  })
}

test('Reports charts are 2 × 2 at 1440 and one column at 390', async ({ page }) => {
  await signIn(page, 'kaluppa')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dashboard/reports')
  const cards = page.locator('main section').filter({ has: page.getByRole('heading', { level: 2 }) })
  await expect(cards.filter({ hasText: 'Trees by stage' })).toBeVisible()
  const lefts = async () => [...new Set(await cards.evaluateAll((els) => els.slice(0, 4).map((el) => Math.round(el.getBoundingClientRect().left))))]
  expect((await lefts()).length).toBe(2)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await lefts()).length).toBe(1)
})

test('Hub is full width with a sticky aside; Inbox is full width', async ({ page }) => {
  await signIn(page, 'farmer.approved')
  await page.setViewportSize({ width: 1920, height: 900 })
  await page.goto('/dashboard/hub')
  const aside = page.locator('aside').filter({ hasText: 'Most viewed this month' })
  await expect(aside).toBeVisible()
  const mainWidth = await page.locator('main').first().evaluate((el) => el.getBoundingClientRect().width)
  expect(mainWidth).toBeGreaterThan(1500)
  await expect(page.locator('article').first()).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 2000))
  await expect.poll(() => topOf(aside)).toBe(88)
  await page.goto('/dashboard/inbox')
  const inbox = page.getByRole('region', { name: 'Inbox' })
  await expect(inbox).toBeVisible()
  expect(await inbox.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(1500)
})
