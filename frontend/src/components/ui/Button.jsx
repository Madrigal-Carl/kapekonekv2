import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

// Buttons.dc.html: one row per variant (default · hover); focus ring and disabled opacity come from the base.
const VARIANTS = {
  solid: 'border-roast bg-roast text-white hover:bg-roast-hover hover:text-white',
  outline: 'border-sand-strong bg-white text-ink hover:bg-cream hover:text-ink',
  soft: 'border-crema bg-crema text-tone-roast-ink hover:bg-soft-hover hover:text-tone-roast-ink',
  ghost: 'border-transparent bg-transparent text-roast hover:bg-highlight hover:text-roast',
  danger: 'border-logout bg-logout text-white hover:bg-danger-hover hover:text-white',
  'danger-outline': 'border-danger-outline bg-white text-logout hover:bg-danger-soft hover:text-logout',
  success: 'border-success bg-success text-white hover:bg-success-hover hover:text-white',
  link: 'border-transparent bg-transparent px-0.5 text-roast hover:text-roast hover:underline',
  // on dark backgrounds (hero, auth panel, footer)
  light: 'border-crema bg-crema text-espresso hover:border-white hover:bg-white hover:text-espresso',
  glass: 'border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white',
  caramel: 'border-caramel bg-caramel text-espresso hover:border-caramel-light hover:bg-caramel-light hover:text-espresso',
  // button on a notice banner (Phase 1 screens)
  notice: 'border-notice-line-strong bg-white text-notice-ink hover:bg-notice-bg hover:text-notice-ink',
}

const SIZES = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-[42px] px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
}
const SQUARE = { sm: 'w-9 px-0', md: 'w-[42px] px-0', lg: 'w-12 px-0' }

/**
 * The one button (Buttons.dc.html); `variant="bare"` only resets, for clickable rows, tabs and chips.
 * `as` renders a router `Link` or an `<a>` styled as a button.
 * @param {{
 *   variant?: keyof typeof VARIANTS, size?: 'sm'|'md'|'lg', as?: 'button'|'a'|typeof Link,
 *   leftIcon?: React.ReactNode, rightIcon?: React.ReactNode, iconOnly?: boolean,
 *   loading?: boolean, loadingLabel?: React.ReactNode, fullWidth?: boolean,
 * } & React.ButtonHTMLAttributes<HTMLButtonElement> & { to?: string, href?: string }} props
 */
export function Button({
  variant = 'solid',
  size = 'md',
  as: As = 'button',
  leftIcon,
  rightIcon,
  iconOnly = false,
  loading,
  loadingLabel,
  fullWidth = false,
  className,
  children,
  type = 'button',
  disabled,
  ...props
}) {
  if (import.meta.env.DEV && iconOnly && !props['aria-label'] && !props['aria-labelledby']) {
    console.warn('<Button iconOnly> needs an aria-label.')
  }
  const off = disabled || loading
  // `bare`: controls that aren't drawn as buttons (menu rows, tabs, chips, thumbnails, dots) keep their own classes.
  const classes = variant === 'bare' ? cn('cursor-pointer disabled:cursor-not-allowed', className) : cn(
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control border font-semibold no-underline transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45',
    SIZES[size],
    iconOnly && SQUARE[size],
    fullWidth && 'w-full',
    VARIANTS[variant],
    className,
  )
  const content = (
    <>
      {leftIcon}
      {children}
      {rightIcon}
    </>
  )
  // While loading, the label stays (invisible) under the spinner so the button keeps its width.
  const body =
    loading === undefined ? (
      content
    ) : (
      <span className="grid justify-items-center">
        <span className={cn('col-start-1 row-start-1 inline-flex items-center gap-2', loading && 'invisible')}>{content}</span>
        {loading && (
          <span className="col-start-1 row-start-1 inline-flex items-center gap-2">
            <Spinner className="size-3.5" />
            {!iconOnly && (loadingLabel ?? children)}
          </span>
        )}
      </span>
    )

  if (As === 'button') {
    return (
      <button type={type} className={classes} disabled={off} aria-busy={loading || undefined} {...props}>
        {body}
      </button>
    )
  }
  // Links can't be disabled; aria-disabled styles them and the click is dropped.
  return (
    <As
      {...props}
      className={classes}
      aria-disabled={off || undefined}
      tabIndex={off ? -1 : props.tabIndex}
      onClick={off ? (e) => e.preventDefault() : props.onClick}
    >
      {body}
    </As>
  )
}
