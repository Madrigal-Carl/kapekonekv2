import { expect, test } from '@playwright/test'

// M13: the Hub (Hub.dc.html), its fixed media frames, and the landing page's top 3 (Main.dc.html).
// Change 07: posting in the Create post modal and reading in the post viewer (HubCreatePost, HubPostView, HubPostText).
const API = 'http://localhost:5100/api'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axh0n0AAAAASUVORK5CYII=', 'base64')

async function signIn(page, identifier) {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('KapeKonek@123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
const noSideScroll = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width)
const card = (page, text) => page.getByRole('article').filter({ hasText: text })
const trigger = (page) => page.getByRole('region', { name: 'Create a post' })

test('farmer posts with tags, reacts and comments; Kaluppa removes it with a reason and the farmer is notified', async ({ browser }) => {
  const rodel = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  const kaluppa = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await signIn(rodel, 'kapekonek.farmer.approved@gmail.com')
  await signIn(kaluppa, 'kapekonek.kaluppa@gmail.com')

  await rodel.goto('/dashboard/hub')
  await expect(rodel.getByRole('heading', { name: 'Hub', level: 1 })).toBeVisible()
  await expect(rodel.getByText('On the landing page').first()).toBeVisible()
  const text = `Selling my beans outside KapeKonek, message me ${Date.now()}`
  await trigger(rodel).getByRole('button', { name: 'Tags' }).click()
  const compose = rodel.getByRole('dialog', { name: 'Create post' })
  await compose.getByRole('button', { name: '#harvesting' }).click()
  await compose.getByLabel('Post text').fill(text)
  await compose.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(compose).toHaveCount(0)
  await expect(rodel.getByRole('status')).toContainText('Posted to the Hub.')
  const mine = card(rodel, text)
  await expect(mine).toContainText('#harvesting')

  await mine.getByRole('button', { name: 'React' }).click()
  await mine.getByRole('button', { name: 'Love' }).click()
  await expect(mine.getByRole('button', { name: 'Love', pressed: true })).toBeVisible()
  await expect(mine).toContainText('1 reaction')

  // Comment opens the viewer (its own URL) with the comment box focused; Esc closes it and the card shows the last comment.
  await mine.getByRole('button', { name: 'Comment', exact: true }).click()
  const viewer = rodel.getByRole('dialog', { name: 'Rodel Mendoza' })
  await expect(rodel).toHaveURL(/\/dashboard\/hub\/posts\/\w+/)
  await expect(viewer.getByText('No comments yet. Be the first to comment.')).toBeVisible()
  await expect(viewer.getByLabel('Write a comment')).toBeFocused()
  await rodel.keyboard.type('Message me for prices.')
  await rodel.keyboard.press('Enter')
  await expect(viewer.getByText('Message me for prices.')).toBeVisible()
  await rodel.keyboard.press('Escape')
  await expect(viewer).toHaveCount(0)
  await expect(rodel).toHaveURL(/\/dashboard\/hub$/)
  await expect(mine.getByRole('button', { name: 'Comment', exact: true })).toBeFocused()
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
  test(`portrait photos never change a card's height; the viewer pages through them at ${width}px`, async ({ browser }) => {
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

    const tile = roast.getByRole('button', { name: /Open photo 2 of 6/ })
    await tile.click()
    const viewer = page.getByRole('dialog')
    await expect(page).toHaveURL(/\/dashboard\/hub\/posts\/\w+\?media=1$/)
    await expect(viewer.getByText('2 / 6')).toBeVisible()
    await viewer.getByRole('button', { name: 'Next' }).click()
    await expect(viewer.getByText('3 / 6')).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(viewer.getByText('4 / 6')).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await expect(viewer.getByText('3 / 6')).toBeVisible()
    await viewer.getByRole('button', { name: 'Show photo 6' }).click()
    await expect(viewer.getByText('6 / 6')).toBeVisible()
    await expect(viewer.getByRole('button', { name: 'Next' })).toHaveCount(0)
    // The stage sits beside the panel, or above it on a phone; nothing scrolls sideways.
    const stage = await viewer.getByRole('button', { name: 'Close post' }).boundingBox()
    const panel = await viewer.getByRole('region', { name: 'Post details and comments' }).boundingBox()
    if (width === 390) expect(stage.y).toBeLessThan(panel.y)
    else expect(stage.x).toBeGreaterThan(panel.x + panel.width)
    await noSideScroll(page)
    // The current photo loads and shows large (contain), not as a thumbnail.
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('[role="dialog"] img')].some((i) => i.naturalWidth > 0 && i.getBoundingClientRect().width > 300)), { timeout: 20_000 }).toBe(true)
    await page.screenshot({ path: `test-results/hub/viewer-${width}.png` })

    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)
    await expect(page).toHaveURL(/\/dashboard\/hub$/)
    await expect(tile).toBeFocused()
    expect(Math.abs((await grid.boundingBox()).height - box.height)).toBeLessThan(1)

    // The back button closes it too.
    await tile.click()
    await expect(viewer).toBeVisible()
    await page.goBack()
    await expect(viewer).toHaveCount(0)
  })
}

test('posts with a photo and tags, edits it, discards a draft, and reads a text post in the dialog', async ({ page }) => {
  await signIn(page, 'kapekonek.farmer.approved@gmail.com')
  await page.goto('/dashboard/hub')
  const text = `Drying rack photo ${Date.now()}`
  await trigger(page).getByRole('button', { name: 'Photo / video' }).click()
  const compose = page.getByRole('dialog', { name: 'Create post' })
  await expect(compose.getByRole('button', { name: /Add photos or videos or drag and drop/ })).toBeVisible()
  await compose.locator('input[type="file"]').setInputFiles({ name: 'rack.png', mimeType: 'image/png', buffer: PNG })
  await expect(compose.getByRole('img', { name: 'Post photo 1' })).toBeVisible({ timeout: 20_000 })
  await expect(compose.getByRole('button', { name: 'Post', exact: true })).toBeDisabled() // the API needs text
  await compose.getByRole('button', { name: 'Add tags' }).click()
  await compose.getByRole('button', { name: '#processing' }).click()
  await compose.getByLabel('Post text').fill(text)
  await page.screenshot({ path: 'test-results/hub/create-1440.png' })
  await compose.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Posted to the Hub.')
  const mine = card(page, text)
  await expect(mine).toContainText('#processing')
  await expect(mine.getByTestId('media-grid')).toBeVisible()

  await mine.getByRole('button', { name: 'Post options' }).click()
  await page.getByRole('menuitem', { name: 'Edit post' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit post' })
  await expect(edit.getByLabel('Post text')).toHaveValue(text)
  await edit.getByLabel('Post text').fill(`${text} (edited)`)
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Post updated.')
  await expect(mine).toContainText('(edited)')

  await trigger(page).getByRole('button', { name: /What’s on your mind/ }).click()
  await compose.getByLabel('Post text').fill('Half a thought')
  await page.keyboard.press('Escape')
  const ask = page.getByRole('dialog', { name: 'Discard this post?' })
  await ask.getByRole('button', { name: 'Keep editing' }).click()
  await expect(compose.getByLabel('Post text')).toHaveValue('Half a thought')
  await compose.getByRole('button', { name: 'Close' }).click()
  await ask.getByRole('button', { name: 'Discard' }).click()
  await expect(compose).toHaveCount(0)
  await expect(page.getByText('Half a thought')).toHaveCount(0)

  // Text-only posts open in the centered dialog.
  await card(page, 'Group meeting this Saturday').getByRole('button', { name: /^View all \d+ comments$/ }).click()
  await expect(page.getByRole('dialog').getByText(/’s post$/)).toBeVisible()
  await page.screenshot({ path: 'test-results/hub/text-1440.png' })
  await page.keyboard.press('Escape')

  await page.setViewportSize({ width: 390, height: 844 })
  await trigger(page).getByRole('button', { name: /What’s on your mind/ }).click()
  expect((await compose.boundingBox()).width).toBe(390)
  await noSideScroll(page)
  await page.screenshot({ path: 'test-results/hub/create-390.png' })
})

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
  await expect(page.getByRole('button', { name: /What’s on your mind/ })).toHaveCount(0)
})

test('a caption over 240 characters ends in See more, which opens the whole post; the author deletes it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await signIn(page, 'kapekonek.farmer.approved@gmail.com')
  await page.goto('/dashboard/hub')
  const text = Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of my drying notes ${Date.now()}`).join('\n')
  await trigger(page).getByRole('button', { name: /What’s on your mind/ }).click()
  await page.getByRole('dialog', { name: 'Create post' }).getByLabel('Post text').fill(text)
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  const mine = card(page, 'Line 1 of my drying notes')
  await expect(mine).not.toContainText('Line 12 of my drying notes')
  await expect(card(page, 'Delivery now reaches every town').getByRole('button', { name: 'See more' })).toHaveCount(0)
  await mine.getByRole('button', { name: 'See more' }).click()
  const viewer = page.getByRole('dialog', { name: 'Rodel Mendoza' })
  await expect(viewer.getByText(/Line 12 of my drying notes/)).toBeVisible()
  await noSideScroll(page)
  await page.keyboard.press('Escape')

  await mine.getByRole('button', { name: 'Post options' }).click()
  await page.getByRole('menuitem', { name: 'Delete post' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Delete/ }).click()
  await expect(page.getByRole('status')).toContainText('Your post was deleted.')
  await expect(card(page, 'Line 1 of my drying notes')).toHaveCount(0)
})
