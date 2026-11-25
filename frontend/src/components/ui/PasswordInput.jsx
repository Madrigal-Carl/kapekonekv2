import { IconCheck, IconEye, IconEyeOff } from '@/components/ui/icons'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { PASSWORD_RULE, passwordRule } from '@/schemas/rules'
import { Input } from './Input'

/**
 * Password field with an eye toggle. Pass `show`/`onToggle` to share one toggle between fields.
 * @param {{ show?: boolean, onToggle?: () => void, toggleLabel?: [string, string] } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
export function PasswordInput({ show: shownProp, onToggle, toggleLabel = ['Show password', 'Hide password'], className, ...props }) {
  const [ownShow, setOwnShow] = useState(false)
  const show = shownProp ?? ownShow
  const toggle = onToggle ?? (() => setOwnShow((v) => !v))
  const Icon = show ? IconEyeOff : IconEye
  return (
    <div className={cn('relative', className)}>
      <Input type={show ? 'text' : 'password'} className="pr-12" {...props} />
      <button
        type="button"
        onClick={toggle}
        aria-label={show ? toggleLabel[1] : toggleLabel[0]}
        aria-pressed={show}
        className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-control text-ink-3"
      >
        <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.9} />
      </button>
    </div>
  )
}

/** The password rule line; green with a check once `value` satisfies it, red after a failed submit. */
export function PasswordRule({ id, value, invalid = false }) {
  const ok = passwordRule.safeParse(value ?? '').success
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn('mt-2 flex items-center gap-1.5 text-[12.5px]', ok ? 'font-semibold text-success-ink' : invalid ? 'text-danger-ink' : 'text-ink-3')}
    >
      {ok && <IconCheck aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />}
      {PASSWORD_RULE}
    </p>
  )
}
