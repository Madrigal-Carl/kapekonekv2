import { expect, test } from '@playwright/test'

// Change 05 Part C: real PSGC areas are highlighted and the map fits them.
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
/** Features drawn in a highlight layer (the map is exposed on window in dev). */
const drawn = (page, layer) =>
  page.evaluate((id) => {
    const map = window.__kkMap
    return map?.getLayer(id) ? map.queryRenderedFeatures({ layers: [id] }).map((f) => f.properties.barangay ?? f.properties.municipality) : null
  }, layer)

async function expectHighlight(page, scope, { municipality, barangay }) {
  const label = barangay ? `${barangay}, ${municipality} · barangay highlighted` : `${municipality} · municipality highlighted`
  await expect(scope.getByText(label)).toBeVisible()
  await expect.poll(() => drawn(page, 'kk-municipality-fill'), { timeout: 15_000 }).toContain(municipality)
  if (barangay) await expect.poll(() => drawn(page, 'kk-barangay-fill'), { timeout: 15_000 }).toContain(barangay)
}

for (const width of [1440, 390]) {
  test(`address window: Boac then Mainit highlight and fit the map (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page, 'buyer')
    await page.goto('/addresses')
    await page.getByRole('button', { name: /Add (a )?new address/ }).first().click()
    const modal = page.getByRole('dialog', { name: 'Add new address' })
    await pick(page, modal, /^Municipality/, 'Boac')
    await expectHighlight(page, modal, { municipality: 'Boac' })
    await pick(page, modal, /^Barangay/, 'Mainit')
    await expectHighlight(page, modal, { municipality: 'Boac', barangay: 'Mainit' })
    // the camera fits Mainit (about 2 × 4 km): centred on it and zoomed past town level once the move settles (≈ 13 desktop, 11.4 on a phone-sized map)
    const camera = () => page.evaluate(() => {
      const map = window.__kkMap
      const { lng, lat } = map.getCenter()
      return !map.isMoving() && map.getZoom() > 11 && lng > 121.887 && lng < 121.908 && lat > 13.393 && lat < 13.429
    })
    await expect.poll(camera, { timeout: 15_000 }).toBe(true)
    await page.screenshot({ path: `test-results/c05-address-mainit-${width}.png` })
  })
}

test('farm form: Boac then Mainit highlight the areas', async ({ page }) => {
  await signIn(page, 'farmer.approved')
  await page.goto('/dashboard/farms')
  await page.getByRole('button', { name: 'Add farm' }).click()
  const form = page.getByRole('dialog', { name: 'Add a farm' })
  await pick(page, form, /^Municipality/, 'Boac')
  await expectHighlight(page, form, { municipality: 'Boac' })
  await pick(page, form, /^Barangay/, 'Mainit')
  await expectHighlight(page, form, { municipality: 'Boac', barangay: 'Mainit' })
  await page.screenshot({ path: 'test-results/c05-farm-mainit-1440.png' })
})

test('boundaries endpoint is public and cached', async ({ request }) => {
  const res = await request.get('http://localhost:5100/api/locations/boundaries?level=municipality')
  expect(res.status()).toBe(200)
  expect(res.headers()['cache-control']).toBe('public, max-age=604800')
  expect((await res.json()).data.features).toHaveLength(6)
})
