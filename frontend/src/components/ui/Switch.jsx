import { cn } from '@/lib/cn'

/**
 * On/off switch (InventoryForm, SettingsKaluppa): 46×26 track (`sm`: 38×22 for the weekday hours), roast when on.
 * @param {{ checked: boolean, onChange: (next: boolean) => void, label: string, disabled?: boolean, size?: 'md'|'sm', className?: string }} props
 */
export function Switch({ checked, onChange, label, disabled = false, size = 'md', className }) {
  const sm = size === 'sm'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative shrink-0 cursor-pointer rounded-full border-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-roast disabled:cursor-not-allowed disabled:opacity-50',
        sm ? 'h-[22px] w-[38px]' : 'h-[26px] w-[46px]',
        checked ? 'bg-roast' : 'bg-sand-strong',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute top-[3px] rounded-full bg-white shadow-sm transition-[left]', sm ? 'size-4' : 'size-5', checked ? (sm ? 'left-[19px]' : 'left-[23px]') : 'left-[3px]')}
      />
    </button>
  )
}
