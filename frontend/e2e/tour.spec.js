import { expect, test } from '@playwright/test'

// M15: each role through every sidebar item at 1440 and 390 px. Fails on a page error or a 5xx API answer.
// SHOTS=<dir> also saves a full-page screenshot per page for comparing with docs/design/screens.
// Needs `npm run migrate:fresh -- --seed`.
const SHOTS = process.env.SHOTS

async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

for (const who of ['farmer.approved', 'manager.santacruz', 'kaluppa']) {
  for (const width of [1440, 390]) {
    test(`${who} at ${width}px: every sidebar item opens cleanly`, async ({ page }) => {
      test.setTimeout(240_000)
      const problems = []
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`))
      page.on('response', (res) => res.url().includes('/api/') && res.status() >= 500 && problems.push(`${res.status()} ${res.url()}`))
      await page.setViewportSize({ width: 1440, height: 900 }) // read the sidebar at desktop width, then switch
      await signIn(page, who)
      const nav = page.getByRole('complementary', { name: 'Dashboard navigation' }).getByRole('navigation')
      await expect(nav.getByRole('link').first()).toBeVisible()
      const routes = (await nav.getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href'))))
        .filter((href) => href.startsWith('/dashboard/'))
      expect(routes.length).toBeGreaterThanOrEqual(8)
      await page.setViewportSize({ width, height: 900 })
      for (const route of routes) {
        await page.goto(route)
        await expect(page.locator('main').first()).toBeVisible()
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        await page.waitForLoadState('networkidle')
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${who}-${route.split('/').pop()}-${width}.png`, fullPage: true })
      }
      expect(problems).toEqual([])
    })
  }
}
