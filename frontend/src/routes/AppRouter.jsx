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
const AccountSettings = page(() => import('@/pages/dashboard/account/AccountSettings'), 'AccountSettings')
const DashboardAssociation = page(() => import('@/pages/dashboard/account/Association'), 'Association')
const Associations = page(() => import('@/pages/dashboard/associations/Associations'), 'Associations')
const Farmers = page(() => import('@/pages/dashboard/farmers/Farmers'), 'Farmers')
const GroupManagers = page(() => import('@/pages/dashboard/groupManagers/GroupManagers'), 'GroupManagers')
const Beans = page(() => import('@/pages/dashboard/beans/Beans'), 'Beans')
const Inventory = page(() => import('@/pages/dashboard/inventory/Inventory'), 'Inventory')
const DashboardOrders = page(() => import('@/pages/dashboard/orders/Orders'), 'Orders')
const Reviews = page(() => import('@/pages/dashboard/reviews/Reviews'), 'Reviews')
const KaluppaSettings = page(() => import('@/pages/dashboard/settings/Settings'), 'Settings')
const Farms = page(() => import('@/pages/dashboard/records/Farms'), 'Farms')
const Inbox = page(() => import('@/pages/dashboard/inbox/Inbox'), 'Inbox')
const Hub = page(() => import('@/pages/dashboard/hub/Hub'), 'Hub')
const Harvests = page(() => import('@/pages/dashboard/records/Harvests'), 'Harvests')
const Trees = page(() => import('@/pages/dashboard/records/Trees'), 'Trees')
const FarmMap = page(() => import('@/pages/dashboard/map/FarmMap'), 'FarmMap')
const Reports = page(() => import('@/pages/dashboard/reports/Reports'), 'Reports')
const AuditLog = page(() => import('@/pages/dashboard/auditLog/AuditLog'), 'AuditLog')
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
const NotFound = page(() => import('@/pages/errors/NotFound'), 'NotFound')
const Landing = page(() => import('@/pages/storefront/Landing'), 'Landing')
const PostDetail = page(() => import('@/pages/storefront/PostDetail'), 'PostDetail')
const ProductDetail = page(() => import('@/pages/storefront/ProductDetail'), 'ProductDetail')
const Products = page(() => import('@/pages/storefront/Products'), 'Products')

// Built pages: [path, permission, element].
const RECORD_PAGES = [
  ['farmers', 'farmers.manage', <Farmers key="farmers" />],
  ['group-managers', 'group_managers.manage', <GroupManagers key="gm" />],
  ['associations', 'associations.manage', <Associations key="associations" />],
  ['farms', 'farms.manage', <Farms key="farms" />],
  ['trees', 'trees.manage', <Trees key="trees" />],
  ['harvests', 'harvests.manage', <Harvests key="harvests" />],
  ['beans', 'beans.sell', <Beans key="beans" />], // farmers and Group Managers sell; Kaluppa passes every check and reviews
  ['orders', 'orders.view_own', <DashboardOrders key="orders" />], // farmers' own orders; Kaluppa manages all
  ['inventory', 'inventory.manage', <Inventory key="inventory" />],
  ['reviews', 'reviews.moderate', <Reviews key="reviews" />],
  ['settings', 'settings.manage', <KaluppaSettings key="settings" />],
  ['inbox', 'inbox.use', <Inbox key="inbox" />],
  ['inbox/:conversationId', 'inbox.use', <Inbox key="inbox-chat" />],
  ['hub', 'dashboard.view', <Hub key="hub" />],
  ['hub/posts/:id', 'dashboard.view', <Hub key="hub" />], // same key: the feed stays mounted under the post viewer
  ['farm-map', 'map.view', <FarmMap key="farm-map" />],
  ['reports', 'reports.view', <Reports key="reports" />],
  ['audit-log', 'audit.view', <AuditLog key="audit-log" />],
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
