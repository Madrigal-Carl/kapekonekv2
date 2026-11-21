import { expect, test } from '@playwright/test'
import { latestMailLink } from './helpers/mailbox.js'

const API = 'http://localhost:5100/api' // playwright.config.js API_PORT
const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

async function fillSignup(page, { role, first, last, username, email }) {
  await page.goto('/register')
  await page.getByLabel(role === 'farmer' ? 'Sell as a farmer' : 'Buy coffee').check()
  await page.getByLabel('First name').fill(first)
  await page.getByLabel('Last name').fill(last)
  await page.getByLabel('Username').fill(username)
  await expect(page.getByText(`@${username} is available`)).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Password123!')
  await page.getByLabel('Confirm password').fill('Password123!')
  await page.getByRole('button', { name: 'Create account' }).click()
}

async function signIn(page, identifier, password = 'Password123!') {
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('buyer signs up, verifies the email from the mailbox and lands on the storefront', async ({ page }) => {
  const id = unique()
  const email = `e2e.buyer.${id}@example.com`
  await fillSignup(page, { role: 'buyer', first: 'Ella', last: 'Buyer', username: `ella${id}`, email })

  await expect(page).toHaveURL('/verify-email')
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()

  const link = await latestMailLink(email, '/verify-email/confirm')
  await page.goto(new URL(link).pathname + new URL(link).search)
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Welcome, Ella' })).toBeVisible()
})

test('farmer signs up and goes straight to the dashboard with the unverified banner', async ({ page }) => {
  const id = unique()
  await fillSignup(page, { role: 'farmer', first: 'Fred', last: 'Farmer', username: `fred${id}`, email: `e2e.farmer.${id}@example.com` })
  await expect(page).toHaveURL('/dashboard/overview')
  await expect(page.getByRole('heading', { name: /, Fred$/ })).toBeVisible()
  await expect(page.getByText("Your email isn't verified yet. You can keep using your dashboard.")).toBeVisible()
})

test('forgot password → reset → sign in with the new password', async ({ page, request }) => {
  const id = unique()
  const email = `e2e.reset.${id}@example.com`
  const created = await request.post(`${API}/auth/register`, {
    data: { firstName: 'Rita', lastName: 'Reset', username: `rita${id}`, email, password: 'Password123!', role: 'buyer' },
  })
  expect(created.status()).toBe(201)

  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a reset link' }).click()
  await expect(page.getByText('If an account uses that email, a reset link is on its way.')).toBeVisible()

  const link = new URL(await latestMailLink(email, '/reset-password'))
  await page.goto(link.pathname + link.search)
  await expect(page.getByText(email)).toBeVisible()
  await page.getByLabel('New password', { exact: true }).fill('NewPass456!')
  await page.getByLabel('Confirm new password').fill('NewPass456!')
  await page.getByRole('button', { name: 'Reset password' }).click()

  await expect(page).toHaveURL('/login')
  await signIn(page, `rita${id}`, 'NewPass456!')
  await expect(page).toHaveURL('/verify-email') // still an unverified buyer

  await page.goto(link.pathname + link.search)
  await page.getByLabel('New password', { exact: true }).fill('Other789!!')
  await page.getByLabel('Confirm new password').fill('Other789!!')
  await page.getByRole('button', { name: 'Reset password' }).click()
  await expect(page.getByText('This reset link has expired or was already used.')).toBeVisible()
})

test('guard: a signed-in farmer visiting the storefront goes to the dashboard', async ({ page }) => {
  await page.goto('/login')
  await signIn(page, 'farmer1@kapekonek.test')
  await expect(page).toHaveURL('/dashboard/overview')
  await page.goto('/')
  await expect(page).toHaveURL('/dashboard/overview')
})

test('guard: a guest opening the dashboard signs in and comes back', async ({ page }) => {
  await page.goto('/dashboard/overview')
  await expect(page).toHaveURL('/login?redirect=%2Fdashboard%2Foverview')
  await signIn(page, 'manager@kapekonek.test')
  await expect(page).toHaveURL('/dashboard/overview')
  await expect(page.getByText('Group Manager').first()).toBeVisible()
})

test('guard: a buyer opening the dashboard sees 403; ?redirect to another site is ignored', async ({ page }) => {
  await page.goto('/login?redirect=//evil.com')
  await signIn(page, 'buyer@kapekonek.test')
  await expect(page).toHaveURL('/')
  await page.goto('/dashboard/overview')
  await expect(page.getByRole('heading', { name: "You can't open this page" })).toBeVisible()
})

test('logout asks first, then signs out', async ({ page }) => {
  await page.goto('/login')
  await signIn(page, 'kaluppa@kapekonek.test')
  await expect(page).toHaveURL('/dashboard/overview')
  await page.getByRole('button', { name: 'Log out' }).click()
  const dialog = page.getByRole('dialog', { name: 'Log out of KapeKonek?' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Log out' }).click()
  await dialog.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
})

test('wrong password shows one generic message', async ({ page }) => {
  await page.goto('/login')
  await signIn(page, 'buyer@kapekonek.test', 'Wrong123!')
  await expect(page.getByRole('alert')).toHaveText('The email, username or password is incorrect.')
})
