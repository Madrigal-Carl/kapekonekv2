import { cn } from '@/lib/cn'

/** The Farm Map pin (MiniMap.dc.html): farmer roast, Kaluppa espresso; a caramel ring when selected. */
export function FarmPin({ tone, selected }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 28" width="30" height="36">
      <path d="M12 27s9-8.2 9-15a9 9 0 0 0-18 0c0 6.8 9 15 9 15Z" className={cn(tone === 'kaluppa' ? 'fill-espresso' : 'fill-roast', selected ? 'stroke-caramel' : 'stroke-white')} strokeWidth={selected ? 2.4 : 1.5} />
      <circle cx="12" cy="12" r="3.6" className="fill-white" />
    </svg>
  )
}
