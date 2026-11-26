import { expect, test } from '@playwright/test'

// Change 06 Part C (PHASE-2-SPEC §3.15): every view drawer ends with History from the audit log.
// Needs `npm run migrate:fresh -- --seed`.
async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

const ROUTES = {
  kaluppa: ['group-managers', 'associations', 'farms', 'trees', 'harvests', 'beans', 'orders', 'inventory', 'reviews'],
  'manager.santacruz': ['farmers', 'farms', 'trees', 'harvests', 'beans'],
  'farmer.approved': ['farms', 'trees', 'harvests', 'beans', 'orders'],
}

for (const [who, routes] of Object.entries(ROUTES)) {
  test(`${who}: History closes each drawer`, async ({ page }) => {
    test.setTimeout(180_000)
    await signIn(page, who)
    for (const route of routes) {
      await test.step(route, async () => {
        await page.goto(`/dashboard/${route}`)
        // Trees and harvests open in their edit drawer; elsewhere the row's View / Manage / Review.
        const open = page.getByRole('button', { name: ['trees', 'harvests'].includes(route) ? /^Edit / : /^(View|Manage|Review|Edit) / }).first()
        await expect(open, `${route} has a row to open`).toBeVisible()
        await open.click()
        const drawer = page.getByRole('dialog').last()
        await expect(drawer).toBeVisible()
        if (route === 'farms') await drawer.getByRole('tab', { name: 'History' }).click() // the farm view keeps History in a tab
        const history = drawer.getByRole('region', { name: 'History' })
        await history.scrollIntoViewIfNeeded()
        // Seeded harvests, beans, orders, products and reviews have no audit entries yet: the empty state counts.
        await expect(history.getByRole('listitem').first().or(history.getByText('No changes recorded yet.')), `${route} shows History`).toBeVisible()
        if (who !== 'kaluppa') await expect(history.getByRole('link', { name: 'Open in audit log' })).toHaveCount(0)
        await page.keyboard.press('Escape')
        await expect(drawer).toBeHidden()
      })
    }
  })
}
