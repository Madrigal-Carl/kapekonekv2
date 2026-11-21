import { cn } from '@/lib/cn'

/** Faint topographic lines along the bottom of dark bands (Main.dc.html hero and farmer band). */
export function Contours({ lines = 6, className }) {
  const gap = lines > 3 ? 24 : 30
  return (
    <svg aria-hidden="true" viewBox="0 0 1440 220" preserveAspectRatio="none" fill="none" className={cn('pointer-events-none absolute inset-x-0 bottom-0 w-full', className)}>
      {Array.from({ length: lines }, (_, i) => {
        const y = i * gap
        return <path key={i} d={`M-20 ${200 - y} C 300 ${150 - y}, 620 ${230 - y}, 940 ${170 - y} S 1300 ${140 - y}, 1460 ${180 - y}`} stroke="currentColor" strokeWidth="1.5" />
      })}
    </svg>
  )
}

/** Coffee branch outline at the hero's right edge (hidden on small screens). */
export function CoffeeBranch({ className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 320" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={cn('pointer-events-none absolute bottom-0 right-[2%] h-[340px] max-[720px]:hidden', className)}>
      <path d="M60 318 C 58 250, 72 190, 60 120 C 54 80, 62 40, 68 6" />
      <path d="M60 262 C 40 254, 24 236, 22 214 C 42 218, 58 236, 60 262Z" />
      <path d="M62 222 C 82 214, 98 196, 100 174 C 80 178, 64 196, 62 222Z" />
      <path d="M60 170 C 40 162, 26 144, 24 122 C 44 126, 58 144, 60 170Z" />
      <path d="M62 128 C 82 120, 96 102, 98 80 C 78 84, 64 102, 62 128Z" />
      <circle cx="70" cy="244" r="6" /><circle cx="80" cy="252" r="6" /><circle cx="72" cy="258" r="6" />
      <circle cx="48" cy="196" r="6" /><circle cx="40" cy="204" r="6" />
      <circle cx="72" cy="150" r="6" /><circle cx="80" cy="142" r="6" />
    </svg>
  )
}
