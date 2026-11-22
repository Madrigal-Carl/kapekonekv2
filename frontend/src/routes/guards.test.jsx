// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { ProtectedRoute } from './guards'

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
