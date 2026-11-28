import { useState } from 'react'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { Button } from '@/components/ui/Button'
import { IconCopy, IconRestore } from '@/components/ui/icons'
import { Input, Label } from '@/components/ui/Input'
import { DEFAULT_PASSWORD } from '@/constants/accounts'

/**
 * Create forms only (GroupManagerCreate / FarmerCreate boards): the read-only default password with Copy.
 * @param {{ id: string, who: string }} props `who` is "Group Manager" or "farmer"
 */
export function DefaultPasswordField({ id, who }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <Label htmlFor={id}>Password</Label>
      <div className="mt-1.5 flex gap-2">
        <Input id={id} value={DEFAULT_PASSWORD} readOnly aria-describedby={`${id}-hint`} className="min-h-[42px] min-w-0 flex-1 border-sand-soft bg-foam px-3 py-[9px] font-mono text-ink-2" />
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(DEFAULT_PASSWORD)
            setCopied(true)
          }}
          className="min-h-[42px] py-0 text-[13px]"
        >
          <IconCopy aria-hidden="true" className="size-[15px]" strokeWidth={2} />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <span id={`${id}-hint`} className="mt-1.5 block text-xs leading-normal text-ink-3">
        Every new account starts with this default password. The {who} signs in with it after verifying their email, then can change it in Settings.
      </span>
    </div>
  )
}

/**
 * Edit forms only (GroupManagerReset board): "Password" box → "Reset {first}'s password?" → back to the default.
 * @param {{ first: string, pending?: boolean, onReset: (done: () => void) => void }} props
 */
export function ResetPasswordBox({ first, pending = false, onReset }) {
  const [asking, setAsking] = useState(false)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sand bg-foam px-4 py-3.5">
      <div className="flex-[1_1_260px]">
        <span className="block text-sm font-semibold">Password</span>
        <span className="mt-0.5 block text-[12.5px] leading-normal text-ink-2">
          Forgot it? Reset it to the default password, <span className="font-mono">{DEFAULT_PASSWORD}</span>.
        </span>
      </div>
      <Button variant="outline" onClick={() => setAsking(true)} className="min-h-10 py-0 text-[13.5px]">
        <IconRestore aria-hidden="true" className="size-[15px]" strokeWidth={2} />
        Reset password
      </Button>
      <ConfirmModal
        open={asking}
        variant="reset_password"
        title={`Reset ${first}’s password?`}
        confirmLabel="Reset password"
        pending={pending}
        onClose={() => setAsking(false)}
        onConfirm={() => onReset(() => setAsking(false))}
      >
        Their password goes back to <strong className="font-mono">{DEFAULT_PASSWORD}</strong>. They’re signed out on every device and get an email saying it was reset.
      </ConfirmModal>
    </div>
  )
}
