import { expect, test } from '@playwright/test'

// Change 06 Part B: the overview date filter for each role — URL-synced, remembered per user. Needs the seeded database.
async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

const SHOTS = process.env.SHOTS_DIR
const PERIODS = [
  ['Today', 'today'],
  ['This week', 'week'],
  ['This month', 'month'],
  ['This year', 'year'],
]

for (const who of ['farmer.approved', 'manager.santacruz', 'kaluppa']) {
  test(`${who}: the overview in all four periods`, async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page, who)
    await page.goto('/dashboard/overview')
    const range = page.getByRole('group', { name: 'Date range' })
    await expect(range.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true')
    for (const [label, key] of PERIODS) {
      await range.getByRole('button', { name: label }).click()
      await expect(page).toHaveURL(new RegExp(`period=${key}`))
      await expect(page.getByText(`Showing ${label.toLowerCase()}`)).toBeVisible()
      await expect(page.locator('main').getByText(/ · (\w{3} \d+)/).first()).toBeVisible()
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/overview-${who}-${key}-1440.png`, fullPage: true })
    }
    // Remembered for this user: a plain visit opens the last period picked.
    await page.goto('/dashboard/overview')
    await expect(range.getByRole('button', { name: 'This year' })).toHaveAttribute('aria-pressed', 'true')
    await page.setViewportSize({ width: 390, height: 844 })
    await range.getByRole('button', { name: 'This month' }).click()
    const segments = await range.getByRole('button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
    expect(Math.max(...segments) - Math.min(...segments)).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/overview-${who}-month-390.png`, fullPage: true })
  })
}
