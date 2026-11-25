import { IconLogOut } from '@/components/ui/icons'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLogout } from '@/hooks/useAuth'

/** "Log out of KapeKonek?" (Modals.dc.html). */
export function LogoutDialog({ open, onClose }) {
  const logout = useLogout()
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => logout.mutate()}
      pending={logout.isPending}
      icon={IconLogOut}
      tone="warning"
      title="Log out of KapeKonek?"
      description="Your cart is saved to your account."
      cancelLabel="Stay signed in"
      confirmLabel="Log out"
    />
  )
}
