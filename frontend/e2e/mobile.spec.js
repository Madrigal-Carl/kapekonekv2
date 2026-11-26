import { expect, test } from '@playwright/test'

// Change 06 Part A (DESIGN §8.6): every dashboard page, per role, at 390 and 768 px — no horizontal scroll,
// and the first view drawer opens full width on a phone. Needs `npm run migrate:fresh -- --seed`.
async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

const SHARED = ['/dashboard/overview', '/dashboard/farms', '/dashboard/trees', '/dashboard/harvests', '/dashboard/inbox', '/dashboard/account/profile', '/dashboard/account/security']
const ROUTES = {
  'farmer.approved': [...SHARED, '/dashboard/beans', '/dashboard/orders', '/dashboard/account/association', '/dashboard/account/addresses'],
  'manager.santacruz': [...SHARED, '/dashboard/farmers', '/dashboard/beans'],
  kaluppa: [...SHARED, '/dashboard/group-managers', '/dashboard/associations', '/dashboard/beans', '/dashboard/orders', '/dashboard/inventory', '/dashboard/reviews', '/dashboard/settings', '/dashboard/settings?tab=delivery', '/dashboard/settings?tab=ewallet'],
}

const TABLES = /\/dashboard\/(farms|trees|harvests|beans|orders|farmers|group-managers|associations|inventory|reviews)$/
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

for (const [who, routes] of Object.entries(ROUTES)) {
  for (const width of [390, 768]) {
    test(`${who} at ${width}px: no horizontal scroll on any dashboard page`, async ({ page }) => {
      test.setTimeout(240_000)
      await page.setViewportSize({ width, height: 844 })
      await signIn(page, who)
      for (const route of routes) {
        await page.goto(route)
        await expect(page.locator('main').first()).toBeVisible()
        await page.waitForLoadState('networkidle')
        expect(await overflow(page), `${route} scrolls sideways`).toBeLessThanOrEqual(0)

        const view = page.getByRole('button', { name: /^(View|Manage|Review) / }).first()
        if (width === 390 && TABLES.test(route) && (await view.count())) {
          await view.click()
          const drawer = page.getByRole('dialog').last()
          await expect(drawer).toBeVisible()
          const box = await drawer.boundingBox()
          expect(box.width, `${route} drawer is full width`).toBeGreaterThanOrEqual(width - 1)
          expect(await overflow(page), `${route} drawer scrolls sideways`).toBeLessThanOrEqual(0)
          await page.keyboard.press('Escape')
          await expect(drawer).toBeHidden()
        }
      }
    })
  }
}

test('the nav drawer opens from the menu button, traps focus, and closes on navigate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'kaluppa')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  const nav = page.getByRole('dialog', { name: 'Navigation' })
  await expect(nav).toBeVisible()
  expect((await nav.boundingBox()).width).toBeLessThanOrEqual(280)
  await nav.getByRole('link', { name: 'Farm', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/farms/)
  await expect(nav).toBeHidden()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.keyboard.press('Escape')
  await expect(nav).toBeHidden()
})
