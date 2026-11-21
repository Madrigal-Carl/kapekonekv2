import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

const VARIANTS = {
  primary: 'bg-roast font-semibold text-white hover:bg-roast-hover hover:text-white',
  outline: 'border border-sand-strong bg-white font-medium text-ink hover:bg-cream hover:text-ink',
  danger: 'bg-danger font-semibold text-white hover:bg-danger-ink hover:text-white',
  notice: 'border border-notice-line-strong bg-white font-semibold text-notice-ink hover:bg-notice-bg',
}

/**
 * Button or, with `to`, a router link styled as one.
 * @param {{ variant?: keyof VARIANTS, to?: string, pending?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function Button({ variant = 'primary', to, pending = false, className, children, type = 'button', disabled, ...props }) {
  const classes = cn(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-[11px] text-sm no-underline transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    className,
  )
  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={classes} disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
