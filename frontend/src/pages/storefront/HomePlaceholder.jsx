import { useState } from 'react'
import { LogoutDialog } from '@/components/auth/LogoutDialog'
import { BeanMark } from '@/components/ui/BeanMark'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { useAuth } from '@/hooks/useAuth'

// shortcut: stand-in for `/` until the storefront (Main.dc.html, navbar, footer) lands in M3; delete it then.
export function HomePlaceholder() {
  const { user, isAuthenticated } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)
  return (
    <main className="grid min-h-screen place-items-center bg-foam px-5 py-12">
      <div className="w-full max-w-[440px] rounded-card border border-sand bg-white p-7 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-card bg-espresso text-caramel-light">
          <BeanMark className="size-6" />
        </span>
        <Eyebrow className="mt-5">KapeKonek · Kaluppa, Marinduque</Eyebrow>
        <h1 className="mt-3 text-[28px] font-medium leading-[1.15] tracking-[-0.02em]">
          {isAuthenticated ? `Welcome, ${user.firstName}` : 'From Marinduque farms to your door.'}
        </h1>
        <p className="mt-2 text-[14.5px] leading-[1.6] text-ink-2">The coffee storefront opens here in the next milestone.</p>
        <div className="mt-6 flex gap-2.5">
          {isAuthenticated ? (
            <Button variant="outline" className="flex-1" onClick={() => setConfirmLogout(true)}>
              Log out
            </Button>
          ) : (
            <>
              <Button to="/login" variant="outline" className="flex-1">
                Log in
              </Button>
              <Button to="/register" className="flex-1">
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
      <LogoutDialog open={confirmLogout} onClose={() => setConfirmLogout(false)} />
    </main>
  )
}
