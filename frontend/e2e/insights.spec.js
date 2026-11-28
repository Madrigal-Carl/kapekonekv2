import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

// M14 (PHASE-2-SPEC §3.11–3.12): Farm Map, Reports and the Audit log. Needs `npm run migrate:fresh -- --seed`.
async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
const farmCount = async (page) => Number((await page.getByRole('region', { name: 'Farms' }).getByRole('heading').textContent()).match(/\d+/)[0])

test('Kaluppa filters the Farm Map by association, picks a farm and opens it', async ({ page }) => {
  await signIn(page, 'kaluppa')
  await page.goto('/dashboard/farm-map')
  await expect(page.getByRole('heading', { name: 'Farm Map' })).toBeVisible()
  const list = page.getByRole('region', { name: 'Farms' })
  await expect(list.getByRole('heading', { name: /^\d+ farms?$/ })).toBeVisible()
  await expect(list.getByRole('button').first()).toBeVisible()
  const all = await farmCount(page)

  await page.getByRole('button', { name: /^Association/ }).click()
  await page.getByRole('option', { name: 'Boac Highland Farmers', exact: true }).click()
  await expect(page).toHaveURL(/association=/)
  await expect.poll(() => farmCount(page)).toBeLessThan(all)

  await list.getByRole('button').first().click()
  const pop = page.getByRole('dialog').filter({ has: page.getByRole('link', { name: 'Open farm' }) })
  await expect(pop).toBeVisible()
  await expect(pop.getByText('Association')).toBeVisible()
  await pop.getByRole('link', { name: 'Open farm' }).click()
  await expect(page).toHaveURL(/\/dashboard\/farms\?open=/)
})

test('a farmer sees only their own farms on the map', async ({ page }) => {
  await signIn(page, 'farmer.approved')
  await page.goto('/dashboard/farm-map')
  await expect(page.getByText('Your farms on the map. Click a pin for details.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Association/ })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Farms' }).getByText(/^Kaluppa farm ·/)).toHaveCount(0)
})

test('Kaluppa exports the Reports as CSV and PDF with the filters on screen', async ({ page }) => {
  await signIn(page, 'kaluppa')
  await page.goto('/dashboard/reports')
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Store sales' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'By association' }).getByRole('rowheader').first()).toBeVisible()

  const day = /\d{4}-\d{2}-\d{2}/
  await page.getByRole('button', { name: 'Export', exact: true }).first().click()
  let modal = page.getByRole('dialog', { name: 'Export report' })
  await expect(modal.getByRole('list', { name: 'Filters' })).toContainText('Last 12 months')
  const [csvFile] = await Promise.all([page.waitForEvent('download'), modal.getByRole('button', { name: 'Export CSV' }).click()])
  expect(csvFile.suggestedFilename()).toMatch(new RegExp(`^kapekonek-report-${day.source}\\.csv$`))
  await expect(page.getByText('CSV is downloading.')).toBeVisible()
  const csv = await readFile(await csvFile.path(), 'utf8')
  expect(csv.charCodeAt(0)).toBe(0xfeff)
  for (const title of ['Harvest by variety', 'Beans bought by Kaluppa', 'Store sales', 'Trees by stage', 'By association']) expect(csv).toContain(title)

  // The table's own Export, as PDF, for "This year".
  await page.getByRole('button', { name: /^Period/ }).click()
  await page.getByRole('option', { name: 'This year' }).click()
  await page.getByRole('region', { name: 'By association' }).getByRole('button', { name: 'Export' }).click()
  modal = page.getByRole('dialog', { name: 'Export “By association”' })
  await expect(modal.getByRole('list', { name: 'Filters' })).toContainText('This year')
  await modal.getByText('PDF', { exact: true }).last().click()
  const [pdfFile] = await Promise.all([page.waitForEvent('download'), modal.getByRole('button', { name: 'Export PDF' }).click()])
  expect(pdfFile.suggestedFilename()).toMatch(new RegExp(`^kapekonek-report-by-association-${day.source}\\.pdf$`))
  expect((await readFile(await pdfFile.path())).subarray(0, 5).toString()).toBe('%PDF-')
})

test('Kaluppa exports Orders as PDF and the Audit log as CSV, following the filters', async ({ page }) => {
  await signIn(page, 'kaluppa')
  await page.goto('/dashboard/orders?status=all')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  let modal = page.getByRole('dialog', { name: 'Export orders' })
  await modal.getByText('PDF', { exact: true }).last().click()
  const [pdf] = await Promise.all([page.waitForEvent('download'), modal.getByRole('button', { name: 'Export PDF' }).click()])
  expect(pdf.suggestedFilename()).toMatch(/^kapekonek-orders-\d{4}-\d{2}-\d{2}\.pdf$/)
  expect((await readFile(await pdf.path())).subarray(0, 5).toString()).toBe('%PDF-')

  await page.goto('/dashboard/audit-log?area=reports')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  modal = page.getByRole('dialog', { name: 'Export audit log' })
  const [csv] = await Promise.all([page.waitForEvent('download'), modal.getByRole('button', { name: 'Export CSV' }).click()])
  const rows = (await readFile(await csv.path(), 'utf8')).replace(/^\uFEFF/, '').trim().split('\r\n').slice(1)
  expect(rows.length).toBeGreaterThan(0) // the Reports exports above were audited
  expect(rows.every((r) => r.includes(',Reports,Export,'))).toBe(true)
})

test('Reports charts stay 2 × 2 on a wide screen (Reports.dc.html)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 })
  await signIn(page, 'kaluppa')
  await page.goto('/dashboard/reports')
  await expect(page.getByRole('heading', { name: 'Trees by stage' })).toBeVisible()
  const tops = await page.locator('section:has(> h2)').evaluateAll((els) => els.slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().top)))
  expect(tops[0]).toBe(tops[1])
  expect(tops[2]).toBe(tops[3])
  expect(tops[2]).toBeGreaterThan(tops[1])
})

test('a Group Manager’s reports are its association’s, without store sales', async ({ page }) => {
  await signIn(page, 'manager.santacruz')
  await page.goto('/dashboard/reports')
  await expect(page.getByText('Harvests, beans and trees in Santa Cruz Coffee Growers.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'By farmer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Store sales' })).toHaveCount(0)
})

test('Kaluppa opens an audit entry’s diff', async ({ page }) => {
  await signIn(page, 'kaluppa')
  await page.goto('/dashboard/audit-log')
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible()
  await page.getByRole('button', { name: /^View / }).first().click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('heading', { name: / · / })).toBeVisible()
  await expect(drawer.getByText('Entry ID')).toBeVisible()
  await expect(drawer.getByText('Passwords and uploaded documents are never stored in the log.')).toBeVisible()
  await expect(page).toHaveURL(/open=.+&mode=view/)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
})

test('guard: a Group Manager can’t open the audit log; a farmer can’t open Reports', async ({ page }) => {
  await signIn(page, 'manager.santacruz')
  await page.goto('/dashboard/audit-log')
  await expect(page.getByRole('heading', { name: 'You can\'t open this page' })).toBeVisible()
  await page.context().clearCookies()
  await signIn(page, 'farmer.approved')
  await page.goto('/dashboard/reports')
  await expect(page.getByRole('heading', { name: 'You can\'t open this page' })).toBeVisible()
})
