import { cn } from '@/lib/cn'

/**
 * On/off switch (InventoryForm, SettingsKaluppa): 46×26 track, roast when on.
 * @param {{ checked: boolean, onChange: (next: boolean) => void, label: string, disabled?: boolean, className?: string }} props
 */
export function Switch({ checked, onChange, label, disabled = false, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-roast disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-roast' : 'bg-sand-strong',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('absolute top-[3px] size-5 rounded-full bg-white shadow-sm transition-[left]', checked ? 'left-[23px]' : 'left-[3px]')} />
    </button>
  )
}
