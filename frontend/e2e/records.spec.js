import { expect, test } from '@playwright/test'

// M9 flows (PHASE-2-SPEC §3.6): needs `npm run migrate:fresh -- --seed` (records seeder: the Pantayin Kaluppa farm managed by
// manager.santacruz, a Lipa farm owned by nestor.perez).
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
const pick = async (page, scope, field, option) => {
  await scope.getByRole('button', { name: field }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('farmer adds a farm, adds trees on it, then records a harvest of that variety', async ({ page }) => {
  await signIn(page, 'farmer.approved')
  await page.goto('/dashboard/farms')
  await expect(page.getByRole('heading', { name: 'My farms' })).toBeVisible()

  await page.getByRole('button', { name: 'Add farm' }).click()
  const form = page.getByRole('dialog', { name: 'Add a farm' })
  await expect(form.getByRole('button', { name: /^Farmer/ })).toHaveCount(0)
  // Change 08: no lot number; the property number is a note, never an input.
  await expect(form.getByLabel('Lot number')).toHaveCount(0)
  await expect(form.getByText('The property number is made automatically when you save (e.g. TCT-2026-0025).')).toBeVisible()
  await form.getByLabel('Size (hectares)').fill('1.255')
  await form.getByRole('button', { name: 'Save farm' }).click()
  await expect(form.getByText('Use at most 2 decimal places, e.g. 1.25')).toBeVisible()
  await form.getByLabel('Size (hectares)').fill('1.25')
  await pick(page, form, /^Municipality/, 'Mogpog') // places the pin at the town
  await pick(page, form, /^Barangay/, 'Bocboc')
  await form.getByRole('button', { name: 'Save farm' }).click()
  const saved = page.getByText(/^Farm saved as TCT-\d{4}-\d{4}\.$/)
  await expect(saved).toBeVisible()
  const code = (await saved.textContent()).match(/TCT-\d{4}-\d{4}/)[0]

  await expect(page.getByRole('columnheader', { name: 'Farm' })).toHaveAttribute('aria-sort', 'ascending')
  await page.getByPlaceholder('Search property no. or barangay').fill(code)
  await expect(page.getByRole('row', { name: new RegExp(code) })).toContainText('1.25 ha')
  await page.getByRole('button', { name: `View ${code}` }).click()
  const view = page.getByRole('dialog', { name: `${code} · Bocboc, Mogpog` })
  await view.getByRole('tab', { name: 'Trees (0)' }).click()
  await view.getByRole('button', { name: 'Add tree group' }).click()
  await pick(page, view, /^Variety/, 'Liberica')
  await pick(page, view, /^Stage/, 'Fruiting')
  await view.getByLabel('Number of trees').fill('25')
  await view.getByLabel('Date planted').fill('2022-03-15')
  await view.getByRole('button', { name: 'Add trees' }).click()
  await expect(view.getByText('25 Liberica trees')).toBeVisible()
  await expect(view.getByRole('tab', { name: 'Trees (1)' })).toBeVisible()
  await view.getByRole('button', { name: 'Close', exact: true }).first().click()

  await page.goto('/dashboard/harvests')
  await page.getByRole('button', { name: 'Add harvest' }).click()
  const record = page.getByRole('dialog', { name: 'Record a harvest' })
  await expect(record.getByRole('button', { name: /^Variety/ })).toBeDisabled()
  await pick(page, record, /^Farm/, `${code} · Bocboc, Mogpog`)
  await expect(record.getByText('This farm has Liberica trees, so only those varieties are listed.')).toBeVisible()
  await record.getByRole('button', { name: /^Variety/ }).click()
  await expect(page.getByRole('option')).toHaveText(['Liberica'])
  await page.getByRole('option', { name: 'Liberica' }).click()
  await record.getByLabel('Yield (kg)').fill('12.5')
  await expect(record.getByLabel('Harvested on')).toHaveValue(today())
  await record.getByRole('button', { name: 'Save harvest' }).click()
  await expect(page.getByText('Harvest saved.')).toBeVisible()

  // Clean up: archive the farm (its tree group goes with it).
  await page.goto(`/dashboard/farms?q=${code}`)
  await page.getByRole('button', { name: `Archive ${code}` }).click()
  await page.getByRole('dialog', { name: 'Archive this farm?' }).getByRole('button', { name: 'Archive farm' }).click()
  await expect(page.getByText(`${code} was archived.`)).toBeVisible()
})

test('Group Manager: Farmer comes first in the form; the managed Kaluppa farm is view-only with its workers', async ({ page }) => {
  await signIn(page, 'manager.santacruz')
  await page.goto('/dashboard/farms')
  await expect(page.getByRole('heading', { name: 'Farms in your association' })).toBeVisible()
  await page.getByRole('button', { name: 'Add farm' }).click()
  const form = page.getByRole('dialog', { name: 'Add a farm' })
  await expect(form.getByRole('button', { name: /^Farmer/ })).toBeVisible()
  await form.getByRole('button', { name: 'Cancel' }).click()

  await page.getByPlaceholder('Search property no. or barangay').fill('Pantayin')
  await expect(page).toHaveURL(/q=Pantayin/) // the debounced search has re-rendered the table
  await page.getByRole('row', { name: /Kaluppa farm/ }).getByRole('button', { name: /^View TCT-/ }).click()
  const view = page.getByRole('dialog', { name: /^TCT-\d{4}-\d{4} · Pantayin, Santa Cruz$/ })
  await expect(view.getByText('Farmers working on it')).toBeVisible()
  await expect(view.getByText('Nestor Perez')).toBeVisible()
  await expect(view.getByRole('button', { name: 'Assign a farmer' })).toBeVisible()
  await expect(view.getByRole('button', { name: 'Edit farm' })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/records/manager-farm-view-1440.png' })
})

test('Kaluppa: Owner filter, and “Managed by” on its farm form', async ({ page }) => {
  await signIn(page, 'kaluppa')
  await page.goto('/dashboard/farms')
  await expect(page.getByRole('heading', { name: 'Farms', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /All owners/ })).toBeVisible()
  await page.getByRole('button', { name: 'Add farm' }).click()
  await expect(page.getByRole('dialog', { name: 'Add a farm' }).getByRole('button', { name: /^Managed by \(Group Manager\)/ })).toBeVisible()
})

test('guard: a farmer opening another farmer’s farm link gets the 404 page', async ({ page, browser }) => {
  const manager = await browser.newPage()
  await signIn(manager, 'manager.santacruz')
  await manager.goto('/dashboard/farms?q=Lipa')
  await manager.getByRole('row', { name: /Nestor Perez/ }).getByRole('button', { name: /^View TCT-/ }).click()
  await expect(manager).toHaveURL(/open=/)
  const link = new URL(manager.url())

  await signIn(page, 'farmer.approved')
  await page.goto(`/dashboard/farms?open=${link.searchParams.get('open')}`)
  await expect(page.getByText('We couldn\'t find that page')).toBeVisible()
})

// The record pages per role, at desktop and phone width: they render, load, and never scroll sideways.
const PAGES = ['/dashboard/farms', '/dashboard/trees', '/dashboard/harvests']
for (const handle of ['kaluppa', 'manager.santacruz', 'farmer.approved']) {
  test(`${handle}: record pages fit at 1440 and 390`, async ({ page }) => {
    await signIn(page, handle)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of PAGES) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.getByText(/couldn’t load/)).toHaveCount(0)
        await expect(page.getByText(/^TCT-\d{4}-\d{4}$/).first()).toBeVisible()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0)
        await page.screenshot({ path: `test-results/records/${handle}-${path.split('/').pop()}-${width}.png`, fullPage: true })
      }
    }
  })
}
