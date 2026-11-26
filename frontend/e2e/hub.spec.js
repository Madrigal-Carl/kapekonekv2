import { expect, test } from '@playwright/test'

// M13: the Hub (Hub.dc.html), its fixed media frames, and the landing page's top 3 (Main.dc.html).
const API = 'http://localhost:5100/api'

async function signIn(page, identifier) {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('KapeKonek@123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
const noSideScroll = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width)
const card = (page, text) => page.getByRole('article').filter({ hasText: text })

test('farmer posts with tags, reacts and comments; Kaluppa removes it with a reason and the farmer is notified', async ({ browser }) => {
  const rodel = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  const kaluppa = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await signIn(rodel, 'kapekonek.farmer.approved@gmail.com')
  await signIn(kaluppa, 'kapekonek.kaluppa@gmail.com')

  await rodel.goto('/dashboard/hub')
  await expect(rodel.getByRole('heading', { name: 'Hub', level: 1 })).toBeVisible()
  await expect(rodel.getByText('On the landing page').first()).toBeVisible()
  const text = `Selling my beans outside KapeKonek, message me ${Date.now()}`
  await rodel.getByLabel('Share an update').click()
  await rodel.getByRole('region', { name: 'Create a post' }).getByRole('button', { name: '#harvesting' }).click()
  await rodel.getByLabel('Share an update').fill(text)
  await rodel.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(rodel.getByRole('status')).toContainText('Posted to the Hub.')
  const mine = card(rodel, text)
  await expect(mine).toContainText('#harvesting')

  await mine.getByRole('button', { name: 'React' }).click()
  await mine.getByRole('button', { name: 'Love' }).click()
  await expect(mine.getByRole('button', { name: 'Love', pressed: true })).toBeVisible()
  await expect(mine).toContainText('1 reaction')
  await mine.getByRole('button', { name: 'Comment' }).click()
  await mine.getByLabel('Write a comment').fill('Message me for prices.')
  await mine.getByLabel('Write a comment').press('Enter')
  await expect(mine).toContainText('Message me for prices.')
  await expect(mine).toContainText('1 comment')

  // Tag filter
  await rodel.getByRole('group', { name: 'Filter by tag' }).getByRole('button', { name: '#harvesting' }).click()
  await expect(rodel).toHaveURL(/tag=harvesting/)
  await expect(card(rodel, text)).toBeVisible()
  await expect(card(rodel, 'Leaf rust is showing up')).toHaveCount(0)

  // Kaluppa: Remove with a reason (a Group Manager's menu has no Remove).
  await kaluppa.goto('/dashboard/hub')
  const theirs = card(kaluppa, text)
  await theirs.getByRole('button', { name: 'Post options' }).click()
  await kaluppa.getByRole('menuitem', { name: 'Remove post' }).click()
  const dialog = kaluppa.getByRole('dialog', { name: 'Remove this post?' })
  await dialog.getByLabel(/Reason/).fill('Selling outside KapeKonek isn’t allowed in the Hub')
  await dialog.getByRole('button', { name: 'Remove post' }).click()
  await expect(kaluppa.getByRole('status')).toContainText('Post removed. The author was notified.')
  await expect(card(kaluppa, text)).toHaveCount(0)

  await rodel.reload()
  await expect(card(rodel, text)).toHaveCount(0)
  await rodel.getByRole('button', { name: /Notifications/ }).click()
  await expect(rodel.getByText('Kaluppa removed your post').first()).toBeVisible()
})

for (const width of [1440, 390]) {
  test(`portrait photos never change a card's height, in the grid or the viewer, at ${width}px`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage()
    await signIn(page, 'kapekonek.farmer.approved@gmail.com')
    await page.goto('/dashboard/hub')
    const roast = card(page, 'Fresh Liberica roasts are in!')
    const grid = roast.getByTestId('media-grid')
    await expect(grid).toBeVisible()
    const box = await grid.boundingBox()
    expect(Math.abs(box.height - (box.width * 10) / 16)).toBeLessThan(2)
    await expect(roast.getByText('+2')).toBeVisible()
    await noSideScroll(page)

    await roast.getByRole('button', { name: /Open photo 1 of 6/ }).click()
    const viewer = page.getByRole('dialog', { name: /Photos and videos/ })
    const stage = viewer.getByTestId('media-stage')
    const first = await stage.boundingBox()
    for (let i = 1; i < 6; i++) {
      await viewer.getByRole('button', { name: 'Next photo or video' }).click()
      await expect(viewer.getByText(`${i + 1} / 6`)).toBeVisible()
      expect(Math.abs((await stage.boundingBox()).height - first.height)).toBeLessThan(1)
    }
    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)
    expect(Math.abs((await grid.boundingBox()).height - box.height)).toBeLessThan(1)
  })
}

test('landing shows the top 3; guests open only those and other posts ask them to sign in', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'What the coffee community is reading' })).toBeVisible()
  const top = (await (await request.get(`${API}/posts/top`)).json()).data
  expect(top.map((p) => p.body.slice(0, 20))).toEqual(['Fresh Liberica roast', 'Leaf rust is showing', 'How we sort and dry '])
  await expect(page.getByText(`${top[0].views.toLocaleString('en-PH')} views`)).toBeVisible()

  await page.goto(`/posts/${top[0]._id}`)
  await expect(page.getByRole('note')).toContainText('Reacting and commenting are open to KapeKonek farmers')

  // Any other post: sign in (the Phase 1 page for a guest), and a buyer is told it's for the Hub.
  const kaluppa = await request.post(`${API}/auth/login`, { data: { identifier: 'kaluppa', password: 'KapeKonek@123' } })
  expect(kaluppa.ok()).toBe(true)
  const feed = (await (await request.get(`${API}/hub/posts?limit=20`)).json()).data
  const other = feed.find((p) => !p.isTop)
  await request.post(`${API}/auth/logout`)
  await page.goto(`/posts/${other._id}`)
  await expect(page.getByRole('heading', { name: 'Sign in to see this post' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' }).last()).toHaveAttribute('href', `/login?redirect=${encodeURIComponent(`/posts/${other._id}`)}`)
})

test('guard: a buyer can’t open the Hub', async ({ page }) => {
  await signIn(page, 'kapekonek.buyer@gmail.com')
  await page.goto('/dashboard/hub')
  await expect(page.getByText('Error 403')).toBeVisible()
  await expect(page.getByLabel('Share an update')).toHaveCount(0)
})
