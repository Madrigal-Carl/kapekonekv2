import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const API = 'http://localhost:5100/api' // playwright.config.js API_PORT
const WIDTHS = [1440, 390]

async function signIn(page, identifier, redirect = '/') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('KapeKonek@123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** WCAG 2.1 A/AA violations on the current page, as "rule: target" lines. */
async function violations(page) {
  // Skeletons and fade-ins settle first, so contrast is checked on the final colors.
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  const { violations: found } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return found.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim() ?? ''} — ${n.html.slice(0, 160)}`))
}

/** Visit each path at both widths and collect every violation, so one run lists them all. */
async function audit(page, paths) {
  const problems = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of paths) {
      await page.goto(path)
      for (const line of await violations(page)) problems.push(`[${width}] ${path} ${line}`)
    }
  }
  return problems
}

test('guest pages have no WCAG A/AA violations', async ({ page, request }) => {
  const post = (await (await request.get(`${API}/posts/top`)).json()).data[0]
  const problems = await audit(page, [
    '/',
    '/products',
    '/products/robusta-dark-roast',
    `/posts/${post._id}`,
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password?token=x&email=someone%40example.com',
    '/no-such-page',
  ])
  expect(problems, problems.join('\n')).toEqual([])
})

test('buyer pages, drawer, menus and modals have no WCAG A/AA violations', async ({ page }) => {
  test.setTimeout(180_000) // 14 page audits plus 5 overlays
  await signIn(page, 'kapekonek.buyer@gmail.com')
  const orders = (await (await page.request.get(`${API}/orders?limit=1`)).json()).data
  const problems = await audit(page, ['/', '/orders', `/orders/${orders[0]._id}`, '/addresses', '/profile', '/settings', '/checkout'])

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/orders')
  const overlays = [
    ['cart drawer', () => page.getByRole('button', { name: /^Cart, \d+ items?$/ }).click()],
    ['notifications', () => page.getByRole('button', { name: /^Notifications/ }).click()],
    ['account menu', () => page.getByRole('button', { name: /^Account menu for/ }).click()],
    ['logout dialog', async () => {
      await page.getByRole('button', { name: /^Account menu for/ }).click()
      await page.getByRole('menuitem', { name: 'Log out' }).click()
    }],
    ['address modal', async () => {
      await page.goto('/addresses')
      await page.getByRole('button', { name: 'Add new address' }).click()
    }],
  ]
  for (const [name, open] of overlays) {
    await open()
    for (const line of await violations(page)) problems.push(`[${name}] ${line}`)
    await page.keyboard.press('Escape')
    await page.goto('/orders')
  }
  expect(problems, problems.join('\n')).toEqual([])
})

test('verify-email and dashboard pages have no WCAG A/AA violations', async ({ page, browser }) => {
  await signIn(page, 'buyer.unverified')
  const problems = await audit(page, ['/verify-email'])
  const kaluppa = await (await browser.newContext()).newPage()
  await signIn(kaluppa, 'kapekonek.kaluppa@gmail.com')
  problems.push(...(await audit(kaluppa, ['/dashboard/overview'])))
  expect(problems, problems.join('\n')).toEqual([])
})

test('keyboard: cart drawer traps focus and Esc returns it; the bell panel opens and closes by keyboard', async ({ page }) => {
  await signIn(page, 'kapekonek.buyer@gmail.com')
  await page.request.post(`${API}/cart/items`, {
    data: { productId: (await (await page.request.get(`${API}/products/robusta-dark-roast`)).json()).data._id, quantity: 1 },
  })
  await page.goto('/products')

  const cart = page.getByRole('button', { name: /^Cart, \d+ items?$/ })
  await cart.focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press('Tab')
    expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(cart).toBeFocused()

  const bell = page.getByRole('button', { name: /^Notifications/ })
  await bell.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeHidden()
  await expect(bell).toBeFocused()
})

// M15: every sidebar page per dashboard role, at both widths.
for (const who of ['farmer.approved', 'manager.santacruz', 'kaluppa']) {
  test(`${who}: every dashboard page has no WCAG A/AA violations`, async ({ page }) => {
    test.setTimeout(420_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page, who, '/dashboard/overview')
    const nav = page.getByRole('complementary', { name: 'Dashboard navigation' }).getByRole('navigation')
    await expect(nav.getByRole('link').first()).toBeVisible()
    const routes = (await nav.getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href')))).filter((href) => href.startsWith('/dashboard/'))
    const problems = await audit(page, routes)
    expect(problems, problems.join('\n')).toEqual([])
  })
}

test('keyboard: a view drawer traps focus, Esc closes it and focus returns to its row button', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'kaluppa', '/dashboard/farms')
  const view = page.getByRole('button', { name: /^View / }).first()
  await view.focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press('Tab')
    expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(view).toBeFocused()
})

test('Hub: the Create post modal and both post viewers have no WCAG A/AA violations', async ({ page }) => {
  await signIn(page, 'farmer.approved', '/dashboard/hub')
  const problems = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/dashboard/hub')
    await page.getByRole('region', { name: 'Create a post' }).getByRole('button', { name: 'Tags' }).click()
    for (const line of await violations(page)) problems.push(`[${width}] create ${line}`)
    await page.keyboard.press('Escape')
    await page.getByRole('article').filter({ hasText: 'Fresh Liberica roasts are in!' }).getByRole('button', { name: /Open photo 1 of/ }).click()
    for (const line of await violations(page)) problems.push(`[${width}] viewer ${line}`)
    await page.keyboard.press('Escape')
    await page.getByRole('article').filter({ hasText: 'Group meeting this Saturday' }).getByRole('button', { name: /^View all \d+ comments$/ }).click()
    for (const line of await violations(page)) problems.push(`[${width}] text viewer ${line}`)
    await page.keyboard.press('Escape')
  }
  expect(problems).toEqual([])
})
