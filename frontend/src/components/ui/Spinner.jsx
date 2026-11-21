import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Spinner({ className, label }) {
  return (
    <>
      <LoaderCircle aria-hidden="true" className={cn('size-5 animate-spin', className)} />
      {label && <span className="sr-only">{label}</span>}
    </>
  )
}

/** Full-page loading state while the session is checked. */
export function PageSpinner() {
  return (
    <div role="status" className="grid min-h-screen place-items-center text-roast">
      <Spinner className="size-7" label="Loading" />
    </div>
  )
}
