import { TermsGate } from '@/components/legal/TermsGate'
import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { PageSpinner } from '@/components/ui/Spinner'

/** Wraps every route: the page (lazy-loaded, so behind Suspense) plus the toast area. */
export function RootLayout() {
  return (
    <>
      <Suspense fallback={<PageSpinner />}>
        <Outlet />
      </Suspense>
      <TermsGate />
      <Toaster position="top-center" toastOptions={{ className: 'font-sans' }} />
    </>
  )
}
