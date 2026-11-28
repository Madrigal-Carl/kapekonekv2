import { Link } from 'react-router-dom'
import { BeanMark } from '@/components/ui/BeanMark'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { homeFor } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'

/** Shared layout for 403 and 404. */
export function ErrorPage({ code, title, text }) {
  const { roles } = useAuth()
  return (
    <main className="grid min-h-screen place-items-center bg-foam px-5 py-12">
      <div className="w-full max-w-[440px] rounded-card border border-sand bg-white p-7 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-card bg-caramel-tint text-caramel-ink">
          <BeanMark className="size-6" />
        </span>
        <Eyebrow className="mt-5">Error {code}</Eyebrow>
        <h1 className="mt-3 text-[28px] font-medium leading-[1.15] tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 text-[14.5px] leading-[1.6] text-ink-2">{text}</p>
        <Button size="lg" as={Link} to={homeFor(roles)} fullWidth className="mt-6">
          Back to KapeKonek
        </Button>
      </div>
    </main>
  )
}
