import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { skippedThisSession, useAssociationWindow } from '@/stores/associationWindow.store'
import { AssociationModal } from './AssociationModal'

/**
 * Mounted once in the farmer's dashboard. Opens by itself for a farmer with no association, no waiting request and no
 * rejection (PHASE-2-SPEC §3.1), unless they skipped it this session; anything else opens it through the store.
 */
export function AssociationWindow() {
  const { user } = useAuth()
  const { open, rejection, show, close } = useAssociationWindow()
  const due = user?.farmerStatus === 'none' && !skippedThisSession()
  useEffect(() => {
    if (due) show()
  }, [due, show])
  // Keyed so every opening starts with an empty form.
  return <AssociationModal key={open ? 'open' : 'closed'} open={open} rejection={rejection} onClose={close} />
}
