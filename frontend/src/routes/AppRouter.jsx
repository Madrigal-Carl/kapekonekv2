import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DASHBOARD_ROLES } from '@/constants/roles'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { RootLayout } from '@/layouts/RootLayout'
import { StorefrontLayout } from '@/layouts/StorefrontLayout'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { Login } from '@/pages/auth/Login'
import { Register } from '@/pages/auth/Register'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { VerifyEmail } from '@/pages/auth/VerifyEmail'
import { VerifyEmailConfirm } from '@/pages/auth/VerifyEmailConfirm'
import { Overview } from '@/pages/dashboard/Overview'
import { Forbidden } from '@/pages/errors/Forbidden'
import { NotFound } from '@/pages/errors/NotFound'
import { Landing } from '@/pages/storefront/Landing'
import { PostDetail } from '@/pages/storefront/PostDetail'
import { ProductDetail } from '@/pages/storefront/ProductDetail'
import { Products } from '@/pages/storefront/Products'
import { GuestRoute, ProtectedRoute, StorefrontRoute } from './guards'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <StorefrontRoute />,
        children: [
          {
            element: <StorefrontLayout />,
            children: [
              { path: '/', element: <Landing /> },
              { path: '/products', element: <Products /> },
              { path: '/products/:slug', element: <ProductDetail /> },
              { path: '/posts/:id', element: <PostDetail /> },
            ],
          },
        ],
      },
      {
        element: <GuestRoute />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/register', element: <Register /> },
          { path: '/forgot-password', element: <ForgotPassword /> },
        ],
      },
      { path: '/reset-password', element: <ResetPassword /> },
      { path: '/verify-email/confirm', element: <VerifyEmailConfirm /> },
      { element: <ProtectedRoute />, children: [{ path: '/verify-email', element: <VerifyEmail /> }] },
      {
        element: <ProtectedRoute roles={DASHBOARD_ROLES} permissions={['dashboard.view']} />,
        children: [
          {
            path: '/dashboard',
            element: <DashboardLayout />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              { path: 'overview', element: <Overview /> },
            ],
          },
        ],
      },
      { path: '/403', element: <Forbidden /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
