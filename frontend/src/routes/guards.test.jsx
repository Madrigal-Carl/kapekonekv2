// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { ProtectedRoute, StorefrontRoute } from './guards'

afterEach(cleanup)

const signIn = (roles, user) =>
  useAuthStore.setState({
    status: 'ready',
    session: { user: { emailVerifiedAt: '2026-11-01', mustChangePassword: false, ...user }, roles, permissions: ['dashboard.view'] },
  })

const at = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute roles={['farmer', 'group_manager', 'kaluppa']} permissions={['dashboard.view']} requireVerified />}>
          <Route path="/dashboard/overview" element={<p>Overview</p>} />
        </Route>
        <Route path="/set-password" element={<p>Set password</p>} />
        <Route path="/verify-email" element={<p>Verify email</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('ProtectedRoute', () => {
  it('sends a user with a temporary password to /set-password first', () => {
    signIn(['farmer'], { mustChangePassword: true })
    at('/dashboard/overview')
    expect(screen.getByText('Set password')).toBeTruthy()
  })

  it('sends an unverified farmer to /verify-email', () => {
    signIn(['farmer'], { emailVerifiedAt: null })
    at('/dashboard/overview')
    expect(screen.getByText('Verify email')).toBeTruthy()
  })

  it('lets an unverified Group Manager in', () => {
    signIn(['group_manager'], { emailVerifiedAt: null })
    at('/dashboard/overview')
    expect(screen.getByText('Overview')).toBeTruthy()
  })
})

const shop = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<StorefrontRoute />}>
          <Route path="/" element={<p>Landing</p>} />
        </Route>
        <Route element={<StorefrontRoute roles={['buyer', 'farmer']} />}>
          <Route path="/products" element={<p>Products</p>} />
        </Route>
        <Route path="/dashboard/overview" element={<p>Dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('StorefrontRoute', () => {
  it('lets a farmer into the store pages', () => {
    signIn(['farmer'])
    shop('/products')
    expect(screen.getByText('Products')).toBeTruthy()
  })

  it('still sends a farmer from the landing page to the dashboard', () => {
    signIn(['farmer'])
    shop('/')
    expect(screen.getByText('Dashboard')).toBeTruthy()
  })

  it('keeps Group Managers out of the store', () => {
    signIn(['group_manager'])
    shop('/products')
    expect(screen.getByText('Dashboard')).toBeTruthy()
  })
})
