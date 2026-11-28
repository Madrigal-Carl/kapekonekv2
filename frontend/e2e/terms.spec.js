import { expect, test } from '@playwright/test'

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
