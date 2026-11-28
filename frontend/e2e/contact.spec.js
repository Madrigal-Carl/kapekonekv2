import { expect, test } from '@playwright/test'

// Change 08 Part G: Contact us, and the address book in two tabs.

async function signIn(page, identifier) {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('KapeKonek@123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
const newPage = async (browser, width = 1440) => (await browser.newContext({ viewport: { width, height: 900 } })).newPage()

test('a guest writes to Kaluppa; Kaluppa reads it in Contact messages', async ({ browser }) => {
  const page = await newPage(browser)
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Contact us' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Questions about coffee, orders or selling? Ask Kaluppa.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Contact us' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: '0917 800 1122' })).toHaveAttribute('href', 'tel:+639178001122')
  await expect(page.getByText('Pickup orders are collected here.')).toBeVisible()

  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Please fix the fields marked below.')).toBeVisible()
  await page.screenshot({ path: 'test-results/c08-contact-errors-1440.png', fullPage: true })

  const name = `E2E Guest ${Date.now()}`
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Email').fill(`e2e.guest.${Date.now()}@example.com`)
  await page.getByRole('button', { name: /Topic/ }).click()
  await page.getByRole('option', { name: /An order/ }).click()
  await page.getByLabel(/Order number/).fill('KK-20261118-0014')
  await page.getByLabel('Message').fill('Where is my order? It has been 6 days.')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('heading', { name: 'Message sent' })).toBeVisible()
  await expect(page.getByText(`Thanks, E2E.`)).toBeVisible()
  await page.screenshot({ path: 'test-results/c08-contact-sent-1440.png', fullPage: true })

  const phone = await newPage(browser, 390)
  await phone.goto('/contact')
  await expect(phone.getByRole('button', { name: 'Send message' })).toBeVisible()
  expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await phone.screenshot({ path: 'test-results/c08-contact-390.png', fullPage: true })

  const kaluppa = await newPage(browser)
  await signIn(kaluppa, 'kapekonek.kaluppa@gmail.com')
  await kaluppa.getByRole('link', { name: 'Contact messages' }).click()
  await kaluppa.getByRole('searchbox').fill(name)
  await kaluppa.getByRole('row', { name: new RegExp(name) }).getByRole('button').first().click()
  const drawer = kaluppa.getByRole('dialog', { name: new RegExp(`An order · ${name}`) })
  await expect(drawer.getByText('KK-20261118-0014')).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Reply by email' })).toHaveAttribute('href', /^mailto:e2e\.guest/)
})

test('guard: a Group Manager is sent to the dashboard from /contact', async ({ page }) => {
  await signIn(page, 'kapekonek.manager.santacruz@gmail.com')
  await page.goto('/contact')
  await page.waitForURL('**/dashboard/overview')
})

test('two tabs: a change from the stale tab is refused with a Refresh button', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const tabA = await context.newPage()
  await signIn(tabA, 'kapekonek.buyer@gmail.com')
  const tabB = await context.newPage()
  await tabA.goto('/addresses')
  await tabB.goto('/addresses')
  const makeDefault = (tab) => tab.getByRole('button', { name: 'Set as default' }).first()
  const defaultSaved = (tab, status) => tab.waitForResponse((r) => r.url().endsWith('/default') && r.status() === status)
  await expect(makeDefault(tabA)).toBeVisible()
  await expect(makeDefault(tabB)).toBeVisible()

  await Promise.all([defaultSaved(tabA, 200), makeDefault(tabA).click()])
  // Tab B still holds the old version.
  await Promise.all([defaultSaved(tabB, 409), makeDefault(tabB).click()])
  await expect(tabB.getByText('Your addresses changed in another tab. Refresh and try again.')).toBeVisible()
  await tabB.screenshot({ path: 'test-results/c08-addresses-two-tabs.png' })
  await Promise.all([tabB.waitForResponse((r) => r.url().endsWith('/api/addresses') && r.status() === 200), tabB.getByRole('button', { name: 'Refresh' }).click()])
  await Promise.all([defaultSaved(tabB, 200), makeDefault(tabB).click()])
})
