import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DASHBOARD_ROLES } from '@/constants/roles'
import { AccountLayout } from '@/layouts/AccountLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { RootLayout } from '@/layouts/RootLayout'
import { StorefrontLayout } from '@/layouts/StorefrontLayout'
import { Forbidden } from '@/pages/errors/Forbidden' // the guards render it too
import { GuestRoute, ProtectedRoute, StorefrontRoute } from './guards'
import { AccountSettings } from '@/pages/dashboard/account/AccountSettings'
import { Association as DashboardAssociation } from '@/pages/dashboard/account/Association'
import { Associations } from '@/pages/dashboard/associations/Associations'
import { Farmers } from '@/pages/dashboard/farmers/Farmers'
import { GroupManagers } from '@/pages/dashboard/groupManagers/GroupManagers'
import { Beans } from '@/pages/dashboard/beans/Beans'
import { Orders as DashboardOrders } from '@/pages/dashboard/orders/Orders'
import { Farms } from '@/pages/dashboard/records/Farms'
import { Harvests } from '@/pages/dashboard/records/Harvests'
import { Trees } from '@/pages/dashboard/records/Trees'

// Each page is its own chunk, loaded on first visit (RootLayout's Suspense shows the spinner).
const page = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })))
const ForgotPassword = page(() => import('@/pages/auth/ForgotPassword'), 'ForgotPassword')
const Login = page(() => import('@/pages/auth/Login'), 'Login')
const Register = page(() => import('@/pages/auth/Register'), 'Register')
const ResetPassword = page(() => import('@/pages/auth/ResetPassword'), 'ResetPassword')
const VerifyEmail = page(() => import('@/pages/auth/VerifyEmail'), 'VerifyEmail')
const VerifyEmailConfirm = page(() => import('@/pages/auth/VerifyEmailConfirm'), 'VerifyEmailConfirm')
const Addresses = page(() => import('@/pages/account/Addresses'), 'Addresses')
const FarmerAddresses = page(() => import('@/pages/dashboard/account/FarmerAddresses'), 'FarmerAddresses')
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
  ['inbox/*', 'inbox.use'],
  ['hub/*', 'dashboard.view'],
  ['farm-map', 'map.view'],
  ['inventory', 'inventory.manage'],
  ['reviews', 'reviews.moderate'],
  ['reports', 'reports.view'],
  ['audit-log', 'audit.view'],
  ['settings', 'settings.manage'],
]
// Built pages: [path, permission, element].
const RECORD_PAGES = [
  ['farmers', 'farmers.manage', <Farmers key="farmers" />],
  ['group-managers', 'group_managers.manage', <GroupManagers key="gm" />],
  ['associations', 'associations.manage', <Associations key="associations" />],
  ['farms', 'farms.manage', <Farms key="farms" />],
  ['trees', 'trees.manage', <Trees key="trees" />],
  ['harvests', 'harvests.manage', <Harvests key="harvests" />],
  ['beans', 'beans.sell', <Beans key="beans" />],
  ['orders', 'orders.view_own', <DashboardOrders key="orders" />], // farmers' own orders; Kaluppa manages all // farmers and Group Managers sell; Kaluppa passes every check and reviews
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
              { path: '/posts/:id', element: <PostDetail /> },
            ],
          },
        ],
      },
      {
        // The Store sidebar item (PHASE-2-SPEC §3.7): farmers shop the categories they may buy.
        element: <StorefrontRoute roles={['buyer', 'farmer']} />,
        children: [
          {
            element: <StorefrontLayout />,
            children: [
              { path: '/products', element: <Products /> },
              { path: '/products/:slug', element: <ProductDetail /> },
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
              ...RECORD_PAGES.map(([path, permission, element]) => ({
                element: <ProtectedRoute permissions={[permission]} />,
                children: [{ path, element }],
              })),
              {
                // Tabs are role-keyed (ACCOUNT_TABS); AccountSettings redirects a tab the role doesn't have.
                path: 'account',
                element: <ProtectedRoute permissions={['profile.update']} />,
                children: [
                  {
                    element: <AccountSettings />,
                    children: [
                      { index: true, element: null },
                      { path: 'profile', element: <Profile embedded /> },
                      { path: 'security', element: <Settings embedded /> },
                      { path: 'association', element: <DashboardAssociation /> },
                      { path: 'addresses', element: <FarmerAddresses /> },
                      { path: '*', element: null },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: '/403', element: <Forbidden /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
