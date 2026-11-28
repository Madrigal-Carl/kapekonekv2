import { expect, test } from '@playwright/test'
import { latestMailLink } from './helpers/mailbox.js'

// Change 09: Terms and Conditions at sign-up and at first sign-in.
const API = 'http://localhost:5100/api'

test('sign-up is blocked until the box is ticked; each link opens its tab; I agree ticks it', async ({ page }) => {
  await page.goto('/register')
  const box = page.getByLabel('I agree to KapeKonek’s')
  await expect(box).not.toBeChecked()
  await page.getByRole('button', { name: 'Create account' }).click()
  const error = page.getByRole('alert').filter({ hasText: 'Please agree to the Terms and Conditions to create your account.' })
  await expect(error).toBeVisible()
  await expect(box).toHaveAttribute('aria-invalid', 'true')
  await expect(page).toHaveURL('/register')
  await page.screenshot({ path: 'test-results/c09-register-error-1440.png' })

  await page.getByRole('button', { name: 'Privacy Policy' }).click()
  const modal = page.getByRole('dialog', { name: 'Privacy Policy' })
  await expect(modal.getByRole('tab', { name: 'Privacy Policy' })).toHaveAttribute('aria-selected', 'true')
  await expect(modal.getByRole('heading', { name: 'What we collect' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
  await expect(box).not.toBeChecked()

  await page.getByRole('button', { name: 'Terms and Conditions' }).click()
  const terms = page.getByRole('dialog', { name: 'Terms and Conditions' })
  await expect(terms.getByRole('heading', { name: '1. Using KapeKonek' })).toBeVisible()
  await expect(terms.getByText(/^Version 1\.0 · Last updated/)).toBeVisible()
  await page.screenshot({ path: 'test-results/c09-terms-modal-1440.png' })
  await terms.getByRole('button', { name: 'I agree' }).click()
  await expect(terms).toBeHidden()
  await expect(box).toBeChecked()
  await expect(error).toBeHidden()
})

test('the API refuses sign-up without acceptTerms: true', async ({ request }) => {
  const res = await request.post(`${API}/auth/register`, {
    data: { firstName: 'No', lastName: 'Terms', username: `noterms${Date.now()}`, email: `noterms.${Date.now()}@example.com`, password: 'KapeKonek@123', role: 'buyer' },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).errors).toEqual({ acceptTerms: 'Please agree to the Terms and Conditions to create your account.' })
})

test('at 390px the modal fills the screen', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await page.goto('/register')
  await page.getByRole('button', { name: 'Terms and Conditions' }).click()
  const dialog = page.getByRole('dialog', { name: 'Terms and Conditions' })
  await expect(dialog.getByRole('heading', { name: '1. Using KapeKonek' })).toBeVisible()
  expect(await dialog.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 })
  await expect(dialog.getByRole('button', { name: 'I agree' })).toBeInViewport()
  await page.screenshot({ path: 'test-results/c09-terms-modal-390.png' })
})

async function signIn(page, identifier) {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('KapeKonek@123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('a farmer made by a Group Manager must agree on first sign-in; Sign out works; agreeing continues (Change 09B)', async ({ browser }) => {
  const id = `${Date.now()}`.slice(-7)
  const email = `e2e.terms.${id}@example.com`
  const manager = await (await browser.newContext()).newPage()
  await signIn(manager, 'kapekonek.manager.santacruz@gmail.com')
  const created = await manager.request.post(`${API}/farmers`, { data: { firstName: 'Tess', lastName: `Terms${id}`, username: `tess.${id}`, contactNumber: '09175550150', email } })
  expect(created.status()).toBe(201)

  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await signIn(page, `tess.${id}`)
  await expect(page).toHaveURL('/verify-email') // verify first (Change 08C), no terms yet
  await expect(page.getByRole('dialog', { name: 'Agree to our terms' })).toHaveCount(0)
  const link = new URL(await latestMailLink(email, '/verify-email/confirm'))
  await page.goto(link.pathname + link.search)
  await expect(page).toHaveURL('/dashboard/overview')

  const terms = page.getByRole('dialog', { name: 'Agree to our terms' })
  await expect(terms.getByText('Your account was made for you by Liza Ramos, your Group Manager. Read and agree to these before you start using KapeKonek.')).toBeVisible()
  await page.screenshot({ path: 'test-results/c09-terms-accept-1440.png' })
  // Can't be dismissed, and the API refuses everything else meanwhile.
  await page.keyboard.press('Escape')
  await expect(terms).toBeVisible()
  await expect(terms.getByRole('button', { name: 'Agree and continue' })).toBeDisabled()
  expect((await page.request.get(`${API}/farms`)).status()).toBe(403)
  await page.goto('/dashboard/farms')
  await expect(terms).toBeVisible()

  await terms.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()

  await signIn(page, `tess.${id}`)
  await page.goto('/dashboard/farms')
  await terms.getByLabel('I’ve read and agree to the Terms and Conditions and the Privacy Policy.').check()
  await terms.getByRole('button', { name: 'Agree and continue' }).click()
  await expect(terms).toBeHidden()
  await expect(page).toHaveURL('/dashboard/farms')
  await expect(page.getByRole('heading', { level: 1, name: 'Farms' })).toBeVisible()
  expect((await page.request.get(`${API}/farms`)).status()).toBe(200)
})
