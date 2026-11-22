import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DASHBOARD_ROLES } from '@/constants/roles'
import { AccountLayout } from '@/layouts/AccountLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { RootLayout } from '@/layouts/RootLayout'
import { StorefrontLayout } from '@/layouts/StorefrontLayout'
import { Forbidden } from '@/pages/errors/Forbidden' // the guards render it too
import { GuestRoute, ProtectedRoute, StorefrontRoute } from './guards'

// Each page is its own chunk, loaded on first visit (RootLayout's Suspense shows the spinner).
const page = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })))
const ForgotPassword = page(() => import('@/pages/auth/ForgotPassword'), 'ForgotPassword')
const Login = page(() => import('@/pages/auth/Login'), 'Login')
const Register = page(() => import('@/pages/auth/Register'), 'Register')
const ResetPassword = page(() => import('@/pages/auth/ResetPassword'), 'ResetPassword')
const VerifyEmail = page(() => import('@/pages/auth/VerifyEmail'), 'VerifyEmail')
const VerifyEmailConfirm = page(() => import('@/pages/auth/VerifyEmailConfirm'), 'VerifyEmailConfirm')
const Addresses = page(() => import('@/pages/account/Addresses'), 'Addresses')
const Checkout = page(() => import('@/pages/account/Checkout'), 'Checkout')
const OrderDetail = page(() => import('@/pages/account/OrderDetail'), 'OrderDetail')
const Orders = page(() => import('@/pages/account/Orders'), 'Orders')
const Profile = page(() => import('@/pages/account/Profile'), 'Profile')
const Settings = page(() => import('@/pages/account/Settings'), 'Settings')
const SetPassword = page(() => import('@/pages/auth/SetPassword'), 'SetPassword')
const Overview = page(() => import('@/pages/dashboard/overview/Overview'), 'Overview')
const ComingSoon = page(() => import('@/pages/dashboard/ComingSoon'), 'ComingSoon')
const NotFound = page(() => import('@/pages/errors/NotFound'), 'NotFound')
const Landing = page(() => import('@/pages/storefront/Landing'), 'Landing')
const PostDetail = page(() => import('@/pages/storefront/PostDetail'), 'PostDetail')
const ProductDetail = page(() => import('@/pages/storefront/ProductDetail'), 'ProductDetail')
const Products = page(() => import('@/pages/storefront/Products'), 'Products')

/** Dashboard pages from later milestones: [path, permission]. Each milestone swaps its placeholder for the real page. */
const DASHBOARD_PAGES = [
  ['farms', 'farms.manage'],
  ['trees', 'trees.manage'],
  ['harvests', 'harvests.manage'],
  ['inbox/*', 'inbox.use'],
  ['hub/*', 'dashboard.view'],
  ['beans', 'dashboard.view'], // farmers and Group Managers sell, Kaluppa reviews
  ['orders', 'dashboard.view'], // farmers' own orders, Kaluppa manages all
  ['farm-map', 'map.view'],
  ['farmers', 'farmers.manage'],
  ['group-managers', 'group_managers.manage'],
  ['associations', 'associations.manage'],
  ['inventory', 'inventory.manage'],
  ['reviews', 'reviews.moderate'],
  ['reports', 'reports.view'],
  ['audit-log', 'audit.view'],
  ['settings', 'settings.manage'],
  ['account/*', 'profile.update'],
]

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
      { path: '/set-password', element: <SetPassword /> },
      { path: '/verify-email/confirm', element: <VerifyEmailConfirm /> },
      { element: <ProtectedRoute />, children: [{ path: '/verify-email', element: <VerifyEmail /> }] },
      {
        // Buyer account pages: signed in and verified; each page checks its own permission.
        element: <ProtectedRoute requireVerified />,
        children: [
          {
            element: <AccountLayout />,
            children: [
              { element: <ProtectedRoute permissions={['cart.manage', 'orders.create']} />, children: [{ path: '/checkout', element: <Checkout /> }] },
              {
                element: <ProtectedRoute permissions={['orders.view_own']} />,
                children: [
                  { path: '/orders', element: <Orders /> },
                  { path: '/orders/:id', element: <OrderDetail /> },
                ],
              },
              { element: <ProtectedRoute permissions={['addresses.manage']} />, children: [{ path: '/addresses', element: <Addresses /> }] },
              {
                element: <ProtectedRoute permissions={['profile.update']} />,
                children: [
                  { path: '/profile', element: <Profile /> },
                  { path: '/settings', element: <Settings /> },
                ],
              },
            ],
          },
        ],
      },
      {
        // DESIGN §8.4. Unverified farmers verify first; each page checks its own permission.
        element: <ProtectedRoute roles={DASHBOARD_ROLES} permissions={['dashboard.view']} requireVerified />,
        children: [
          {
            path: '/dashboard',
            element: <DashboardLayout />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              { path: 'overview', element: <Overview /> },
              ...DASHBOARD_PAGES.map(([path, permission]) => ({
                element: <ProtectedRoute permissions={[permission]} />,
                children: [{ path, element: <ComingSoon /> }],
              })),
            ],
          },
        ],
      },
      { path: '/403', element: <Forbidden /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
