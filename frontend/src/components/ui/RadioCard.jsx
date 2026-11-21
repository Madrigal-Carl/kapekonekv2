import { cn } from '@/lib/cn'

/** Radio option drawn as a card. Selected: 2px roast border + highlight background. */
export function RadioCard({ checked, title, description, className, ...inputProps }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-card p-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-roast',
        checked ? 'border-2 border-roast bg-highlight' : 'border border-sand bg-white',
        className,
      )}
    >
      <input type="radio" checked={checked} className="mt-0.5 size-[18px] shrink-0 accent-roast" {...inputProps} />
      <span>
        <span className="block text-[14.5px] font-semibold">{title}</span>
        {description && <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-ink-3">{description}</span>}
      </span>
    </label>
  )
}
