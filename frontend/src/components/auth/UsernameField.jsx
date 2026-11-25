import { Button } from '@/components/ui/Button'
import { IconCircleCheck, IconCircleX } from '@/components/ui/icons'
import { Input, Label } from '@/components/ui/Input'
import { useUsernameSuggestions } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/cn'

const TONE = { muted: 'text-ink-3', taken: 'text-danger-ink', available: 'text-success-ink' }
const ICON = { taken: IconCircleX, available: IconCircleCheck }

/**
 * Username with an `@` prefix, a live status line and 3 one-line suggestion chips built from the name
 * (Register, FarmerForm.dc.html, GroupManagerForm.dc.html). The parent owns `status` (useUsernameStatus) so it can block saving.
 * @param {{
 *   id: string, value: string, status: { tone: 'muted'|'taken'|'available', message: string },
 *   firstName: string, lastName: string, onPick: (username: string) => void, registration: object, className?: string,
 * }} props
 */
export function UsernameField({ id, value, status, firstName, lastName, onPick, registration, className }) {
  const suggestions = useUsernameSuggestions(useDebouncedValue(firstName.trim(), 500), useDebouncedValue(lastName.trim(), 500))
  const Icon = ICON[status.tone]
  return (
    <div className={className}>
      <Label htmlFor={id}>Username</Label>
      <div className="relative mt-2">
        <span aria-hidden="true" className="absolute left-[13px] top-1/2 -translate-y-1/2 text-sm text-ink-4">@</span>
        <Input
          id={id}
          autoComplete="off"
          aria-describedby={`${id}-status`}
          invalid={status.tone === 'taken'}
          className={cn('min-h-11 pl-[31px]', status.tone === 'available' && 'border-success-line')}
          {...registration}
        />
      </div>
      <p id={`${id}-status`} aria-live="polite" className={cn('mt-[7px] flex items-center gap-1.5 text-[12.5px] font-medium', TONE[status.tone])}>
        {Icon && <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.2} />}
        {status.message}
      </p>
      {suggestions.data?.length > 0 && (
        <div className="mt-2.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap">
          <span className="shrink-0 text-xs text-ink-3">Suggestions:</span>
          {suggestions.data.map((name) => (
            <Button
              variant="bare"
              key={name}
              aria-pressed={value === name}
              onClick={() => onPick(name)}
              className={cn(
                'min-h-8 shrink-0 whitespace-nowrap rounded-full border px-[11px] py-[5px] text-[12.5px] text-ink',
                value === name ? 'border-roast bg-crema' : 'border-sand-strong bg-white hover:bg-cream',
              )}
            >
              @{name}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
