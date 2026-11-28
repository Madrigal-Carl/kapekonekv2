import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { latestMailLink } from './helpers/mailbox.js'
import { confirmSave } from './helpers/confirm'

const API = 'http://localhost:5100/api' // playwright.config.js API_PORT
const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
// 1×1 PNG used as the profile photo.
const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axh0n0AAAAASUVORK5CYII=', 'base64')

/** A new verified buyer (these flows change credentials, so they never touch the seeded accounts). */
async function freshBuyer(request) {
  const id = unique()
  const user = { firstName: 'Ana', lastName: 'Reyes', username: `ana${id}`, email: `e2e.account.${id}@example.com`, password: 'KapeKonek@123', role: 'buyer', acceptTerms: true }
  expect((await request.post(`${API}/auth/register`, { data: user })).status()).toBe(201)
  const token = new URL(await latestMailLink(user.email, '/verify-email/confirm')).searchParams.get('token')
  expect((await request.post(`${API}/auth/email/verify`, { data: { token } })).ok()).toBe(true)
  return user
}

async function signIn(page, identifier, password = 'KapeKonek@123', redirect = '/') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(redirect)
}

test('guest opening /profile is sent to log in and comes back', async ({ page, request }) => {
  const user = await freshBuyer(request)
  await page.goto('/profile')
  await expect(page).toHaveURL('/login?redirect=%2Fprofile')
  await page.getByLabel('Email or username').fill(user.username)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/profile')
})

test('profile: taken username, save fields, upload and remove the photo', async ({ page, request }) => {
  const user = await freshBuyer(request)
  await signIn(page, user.username, user.password, '/profile')

  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible()
  await expect(page.getByText('This is your current username')).toBeVisible()
  await expect(page.getByText(user.email)).toBeVisible()
  await expect(page.getByText('Verified', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove' })).toBeDisabled()

  // Someone else's username: the live check says so, and the API refuses it too.
  await page.getByLabel('Username').fill('buyer')
  await expect(page.getByText('@buyer is taken. Try another one.')).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await confirmSave(page)
  await expect(page.getByText('Username is already taken')).toBeVisible()

  const username = `${user.username}.new`
  await page.getByLabel('First name').fill('Anabel')
  await page.getByLabel('Middle name').fill('Cruz')
  await page.getByLabel('Username').fill(username)
  await expect(page.getByText(`@${username} is available`)).toBeVisible()
  await page.getByLabel('Contact number').fill('12345')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Use an 11-digit mobile number starting with 09')).toBeVisible()
  await page.getByLabel('Contact number').fill('0917 222 3344')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog', { name: 'Save these changes?' })).toContainText('First name')
  await confirmSave(page)
  await expect(page.getByText('Your profile is saved')).toBeVisible()
  await expect(page.getByText('This is your current username')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Account menu for Anabel Cruz Reyes' })).toBeVisible()

  // Discard puts back the saved values; a reload shows what the API stored.
  await page.getByLabel('First name').fill('Someone')
  await page.getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByLabel('First name')).toHaveValue('Anabel')
  await page.reload()
  await expect(page.getByLabel('Contact number')).toHaveValue('0917 222 3344')
  await expect(page.getByLabel('Username')).toHaveValue(username)

  // Photo: signed upload to Cloudinary, shown here and in the navbar; then removed.
  await page.getByLabel('Upload photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PHOTO })
  await expect(page.getByText('Your photo is updated')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('img', { name: 'Your profile photo' })).toHaveAttribute('src', /res\.cloudinary\.com/)
  await expect(page.getByRole('button', { name: 'Account menu for Anabel Cruz Reyes' }).locator('img')).toBeVisible()
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('Your photo was removed')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Your profile photo' })).toHaveCount(0)
  await expect(page.getByText('AR', { exact: true }).first()).toBeVisible()
})

test('settings: change email → verify page → new link verifies; change password signs out other devices', async ({ page, request, browser }) => {
  const user = await freshBuyer(request)
  await signIn(page, user.username, user.password, '/settings')
  await expect(page.getByText(`Current: ${user.email}`)).toBeVisible()

  // Wrong current password stays on the page with a field error.
  const newEmail = `e2e.moved.${unique()}@example.com`
  const emailForm = page.getByRole('form', { name: 'Change email' })
  await emailForm.getByLabel('New email').fill(newEmail)
  await emailForm.getByLabel('Current password').fill('wrong-password')
  await emailForm.getByRole('button', { name: 'Update email' }).click()
  await expect(emailForm.getByText('Your current password is incorrect')).toBeVisible()

  await emailForm.getByLabel('Current password').fill(user.password)
  await emailForm.getByRole('button', { name: 'Update email' }).click()
  await expect(page).toHaveURL('/verify-email')
  await expect(page.getByText(newEmail)).toBeVisible()
  await page.goto('/orders')
  await expect(page).toHaveURL('/verify-email') // unverified again: buyer pages are blocked

  // The old address got a notice; the new one a link that verifies it.
  await latestMailLink(user.email, '/forgot-password')
  const link = new URL(await latestMailLink(newEmail, '/verify-email/confirm'))
  await page.goto(link.pathname + link.search)
  await expect(page).toHaveURL('/')
  await page.goto('/settings')
  await expect(page.getByText(`Current: ${newEmail}`)).toBeVisible()

  // A second device signed in with the old password.
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await signIn(otherPage, newEmail, user.password, '/orders')

  const pwForm = page.getByRole('form', { name: 'Change password' })
  await pwForm.getByLabel('Current password').fill(user.password)
  await pwForm.getByLabel('New password', { exact: true }).fill('NewPass456!')
  await expect(pwForm.getByText('At least 8 characters with a letter, a number and a special character')).toHaveClass(/text-success-ink/)
  await pwForm.getByLabel('Confirm new password').fill('NewPass456?')
  await pwForm.getByRole('button', { name: 'Update password' }).click()
  await expect(pwForm.getByText("Passwords don't match")).toBeVisible()
  await pwForm.getByLabel('Confirm new password').fill('NewPass456!')
  await pwForm.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Your password is changed. Your other devices were signed out.')).toBeVisible()

  // This device stays signed in; the other one is sent to log in.
  await page.goto('/orders')
  await expect(page).toHaveURL('/orders')
  await otherPage.goto('/orders')
  await expect(otherPage).toHaveURL('/login?redirect=%2Forders')
  await other.close()

  await page.getByRole('button', { name: /^Account menu for/ }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
  await signIn(page, newEmail, 'NewPass456!')
})
