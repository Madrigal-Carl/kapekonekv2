import { expect, test } from '@playwright/test'

// Change 06 Part D: the star picks the thumbnail; nothing overflows its tile (5 a row in the desktop drawer, 3 on a phone).
async function signIn(page, identifier, password = 'KapeKonek@123') {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

for (const [width, perRow] of [[1440, 5], [390, 3]]) {
  test(`star picker at ${width}px: ${perRow} a row, controls inside each tile`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page, 'kaluppa')
    await page.goto('/dashboard/inventory')
    await page.getByRole('button', { name: /^Edit / }).first().click()
    const drawer = page.getByRole('dialog').last()
    const tiles = drawer.getByRole('list', { name: /Photos/ }).getByRole('listitem')
    await expect(tiles.first()).toBeVisible()
    await expect(drawer.getByText('Thumbnail', { exact: true })).toHaveCount(0)

    const boxes = await tiles.evaluateAll((items) => items.map((li) => li.getBoundingClientRect().top))
    expect(boxes.filter((top) => top === boxes[0]).length).toBe(Math.min(perRow, boxes.length))
    for (const tile of await tiles.all()) {
      const box = await tile.boundingBox()
      for (const control of await tile.getByRole('button').all()) {
        const c = await control.boundingBox()
        expect(c.x >= box.x && c.x + c.width <= box.x + box.width && c.y >= box.y, 'control inside its tile').toBe(true)
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

    const make = drawer.getByRole('button', { name: 'Make photo 2 the thumbnail' })
    if (await make.count()) {
      await make.click()
      await expect(drawer.getByRole('button', { name: 'Photo 2 is the thumbnail' })).toHaveAttribute('aria-pressed', 'true')
      await expect(drawer.getByRole('button', { name: 'Make photo 1 the thumbnail' })).toHaveAttribute('aria-pressed', 'false')
    }
    await page.screenshot({ path: `test-results/thumbnail-${width}.png` })
  })
}
