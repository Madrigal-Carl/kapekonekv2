import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'

/** Wraps every route: the page plus the toast area. */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster position="top-center" toastOptions={{ className: 'font-sans' }} />
    </>
  )
}
