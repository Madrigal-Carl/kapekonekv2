import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconCheck, IconTriangleAlert, IconX } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAdminSetting } from '@/hooks/useAdminSettings'
import { cn } from '@/lib/cn'
import { BranchSettings } from './BranchSettings'
import { DeliverySettings } from './DeliverySettings'
import { EwalletSettings } from './EwalletSettings'

const TABS = [
  { key: 'branch', label: 'Branch', Form: BranchSettings, prop: 'branch' },
  { key: 'delivery', label: 'Delivery fee', Form: DeliverySettings, prop: 'delivery' },
  { key: 'ewallet', label: 'E-wallet', Form: EwalletSettings, prop: 'ewallet' },
]

/** Kaluppa's Settings (SettingsKaluppa.dc.html): Branch, Delivery fee and E-wallet tabs, `?tab=` in the URL. */
export function Settings() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('tab')) ?? TABS[0]
  const setting = useAdminSetting(tab.key)
  const [saved, setSaved] = useState(false)
  const pick = (key) => {
    setSaved(false)
    setParams(key === 'branch' ? {} : { tab: key }, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="System" title="Settings" description="Branch details, delivery fees and e-wallet accounts. Changes apply to new orders and listings only." />
      <div role="tablist" aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-sand">
        {TABS.map((t) => (
          <Button
            key={t.key}
            variant="bare"
            role="tab"
            aria-selected={t.key === tab.key}
            onClick={() => pick(t.key)}
            className={cn('-mb-px min-h-11 shrink-0 border-0 border-b-2 px-3.5 text-sm', t.key === tab.key ? 'border-roast font-semibold text-ink' : 'border-transparent font-medium text-ink-3 hover:text-ink')}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {saved && (
        <div role="status" className="flex items-center gap-2.5 rounded-card border border-tone-green-line bg-tone-green-bg px-3.5 py-3 text-[13.5px] font-medium text-tone-green-ink">
          <IconCheck aria-hidden="true" className="size-[17px] shrink-0" strokeWidth={2.4} />
          <span className="flex-1">Settings saved. New quotes use the updated values.</span>
          <Button variant="bare" aria-label="Dismiss" onClick={() => setSaved(false)} className="grid size-8 place-items-center">
            <IconX aria-hidden="true" className="size-[15px]" />
          </Button>
        </div>
      )}
      {setting.isPending ? (
        <Skeleton className="h-[420px] w-full rounded-card" />
      ) : setting.isError ? (
        <EmptyState icon={IconTriangleAlert} tone="error" title="We couldn’t load these settings" action={<Button variant="outline" onClick={() => setting.refetch()}>Try again</Button>} className="bg-white" />
      ) : (
        <tab.Form key={tab.key} {...{ [tab.prop]: setting.data }} onSaved={() => setSaved(true)} />
      )}
    </div>
  )
}
