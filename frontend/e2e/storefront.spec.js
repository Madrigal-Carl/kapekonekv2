import { expect, test } from '@playwright/test'

async function signIn(page, identifier, password = 'Password123!') {
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('landing shows the hero, featured coffee, latest posts and a one-open FAQ', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Marinduque coffee, delivered to your door.' })).toBeVisible()
  await expect(page.getByText('01 / 03')).toBeVisible()
  await page.getByRole('button', { name: 'Next slide' }).click()
  await expect(page.getByText('02 / 03')).toBeVisible()

  await expect(page.getByRole('heading', { name: "This week's roasts and green beans" })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Add .+ to cart$/ })).toHaveCount(4)

  const first = page.getByRole('button', { name: 'How does delivery work?' })
  const second = page.getByRole('button', { name: 'How do I pay?' })
  await expect(first).toHaveAttribute('aria-expanded', 'true')
  await second.click()
  await expect(second).toHaveAttribute('aria-expanded', 'true')
  await expect(first).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('link', { name: /View post/ }).first().click()
  await expect(page).toHaveURL(/\/posts\/[a-f0-9]{24}$/)
  await expect(page.getByRole('heading', { name: /^Comments/ })).toBeVisible()
  await expect(page.getByRole('note')).toContainText('Reacting and commenting are open to KapeKonek farmers')
  await page.getByRole('button', { name: 'View 1 reply' }).first().click()
  await expect(page.getByRole('button', { name: 'Hide replies' })).toHaveCount(2)
  await page.getByRole('button', { name: 'Next photo or video' }).click()
  await expect(page.getByText('2 / 6')).toBeVisible()
})

test('products: filters live in the URL and scrolling loads more', async ({ page }) => {
  await page.goto('/products')
  const cards = page.getByRole('article')
  await expect(page.getByText('Showing 12 coffee products')).toBeVisible()
  await expect(cards).toHaveCount(9)
  await page.getByRole('contentinfo').scrollIntoViewIfNeeded()
  await expect(cards).toHaveCount(12)

  await page.getByRole('button', { name: 'Liberica', exact: true }).click()
  await expect(page).toHaveURL(/variety=liberica/)
  await expect(page.getByText('Showing 3 coffee products')).toBeVisible()
  // The checkbox mirrors the URL, which the router updates asynchronously.
  await page.getByLabel('Roasted').click()
  await expect(page.getByLabel('Roasted')).toBeChecked()
  await expect(page.getByText('Showing 1 coffee product')).toBeVisible()
  await expect(cards).toHaveCount(1)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Liberica', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Roasted')).toBeChecked()

  await page.getByLabel('Search', { exact: true }).fill('nothing like this')
  await expect(page.getByRole('heading', { name: 'No coffee matches these filters' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear all filters' }).first().click()
  await expect(page.getByText('Showing 12 coffee products')).toBeVisible()
  await expect(page).toHaveURL('/products')
})

test('guard: a guest who taps Add signs in and comes back to the product', async ({ page }) => {
  await page.goto('/products/barako-medium-roast')
  await expect(page.getByRole('heading', { level: 1, name: 'Barako Medium Roast' })).toBeVisible()
  await expect(page.getByText('38 packs available')).toBeVisible()
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await expect(page.getByText('2 × ₱260.00')).toBeVisible()
  await page.getByRole('button', { name: 'Add to cart' }).click()

  await expect(page).toHaveURL('/login?redirect=%2Fproducts%2Fbarako-medium-roast')
  await signIn(page, 'buyer01@kapekonek.test')
  await expect(page).toHaveURL('/products/barako-medium-roast')
  await expect(page.getByRole('button', { name: /^Account menu for / })).toBeVisible()
})

test('a buyer with a completed order can review the coffee', async ({ page }) => {
  await page.goto('/login?redirect=/products/arabica-light-roast')
  await signIn(page, 'buyer@kapekonek.test')
  await expect(page).toHaveURL('/products/arabica-light-roast')
  const form = page.locator('form').filter({ has: page.getByRole('heading', { name: /Write a review|Your review/ }) })
  await expect(form).toBeVisible()
  await form.getByRole('button', { name: '4 stars' }).click()
  await form.getByLabel('Your review').fill('Bright cup, lovely as a pour-over in the morning.')
  await form.getByRole('button', { name: /Post review|Update review/ }).click()
  await expect(page.getByText(/Thanks for your review|Your review was updated/)).toBeVisible()
  await expect(page.getByText('Bright cup, lovely as a pour-over in the morning.')).toBeVisible()
})

test('mobile: the menu opens, closes with Esc and the account menu works by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  const menu = page.getByRole('navigation', { name: 'Menu' })
  await expect(menu.getByRole('link', { name: 'Log in' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await menu.getByRole('link', { name: 'Products' }).click()
  await expect(page).toHaveURL('/products')
  await expect(menu).toBeHidden()

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await signIn(page, 'buyer02@kapekonek.test')
  const trigger = page.getByRole('button', { name: /^Account menu for / })
  await trigger.click()
  await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Orders' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  await expect(trigger).toBeFocused()
})
