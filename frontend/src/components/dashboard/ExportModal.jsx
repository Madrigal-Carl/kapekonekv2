import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { IconDownload } from '@/components/ui/icons'
import { Modal } from '@/components/ui/Modal'
import { useExportFile } from '@/hooks/useExport'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'

const FORMATS = [
  { value: 'csv', label: 'CSV', tag: 'bg-tone-green-bg text-tone-green-ink', text: 'Rows of data for Excel or Google Sheets.' },
  { value: 'pdf', label: 'PDF', tag: 'bg-danger-bg text-danger-ink', text: 'A formatted report with the totals, charts and tables, ready to print or share.' },
]

/**
 * Export as CSV or PDF (ReportsExport.dc.html, DESIGN §8.8). The file follows exactly what's on screen: `download(format)`
 * sends the page's own filters, and the server re-checks the scope.
 * @param {{ open: boolean, title: string, text: string, filters?: { k: string, v: string }[], note: string,
 *   download: (format: 'csv'|'pdf') => Promise<{ blob: Blob, filename: string }>, onClose: () => void }} props
 */
export function ExportModal({ open, title, text, filters = [], note, download, onClose }) {
  const id = useId()
  const [format, setFormat] = useState('csv')
  const file = useExportFile(download)
  const name = format.toUpperCase()
  const go = () =>
    file.mutate(format, {
      onSuccess: () => {
        toast.success(`${name} is downloading.`)
        onClose()
      },
      onError: (error) => toast.error(errorMessage(error)),
    })

  return (
    <Modal open={open} onClose={onClose} labelledBy={`${id}-t`} describedBy={`${id}-d`} className="max-w-[460px] p-6">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-crema text-roast">
        <IconDownload className="size-5" strokeWidth={2} />
      </span>
      <h2 id={`${id}-t`} className="mt-3.5 text-lg font-semibold">{title}</h2>
      <p id={`${id}-d`} className="mt-1.5 text-[13.5px] leading-[1.6] text-ink-2">{text}</p>
      <fieldset className="m-0 mt-3.5 grid grid-cols-2 gap-2.5 border-0 p-0">
        <legend className="sr-only">File format</legend>
        {FORMATS.map((f) => {
          const on = format === f.value
          return (
            <label
              key={f.value}
              className={cn(
                'flex cursor-pointer flex-col items-start gap-1.5 rounded-card p-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-roast',
                on ? 'border-2 border-roast bg-highlight shadow-[0_0_0_3px_rgba(123,74,42,0.12)]' : 'border border-sand bg-white',
              )}
            >
              <input type="radio" name={`${id}-format`} value={f.value} checked={on} onChange={() => setFormat(f.value)} className="sr-only" />
              <span className="flex items-center gap-2 text-[14.5px] font-semibold">
                <span aria-hidden="true" className={cn('grid size-8 place-items-center rounded-md text-[10.5px] font-bold tracking-[0.04em]', f.tag)}>{f.label}</span>
                {f.label}
              </span>
              <span className="text-[12.5px] leading-normal text-ink-2">{f.text}</span>
            </label>
          )
        })}
      </fieldset>
      <div className="mt-3.5 rounded-card border border-sand-soft bg-cream px-3.5 py-3">
        <span className="block text-[12.5px] font-semibold">Uses what’s on screen now</span>
        {filters.length > 0 && (
          <ul aria-label="Filters" className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
            {filters.map((f) => (
              <li key={f.k} className="inline-flex items-center gap-1 rounded-full border border-sand bg-white px-2.5 py-[3px] text-xs">
                <span className="text-ink-3">{f.k}:</span>
                <strong className="font-semibold">{f.v}</strong>
              </li>
            ))}
          </ul>
        )}
        <span className="mt-2 block text-xs leading-normal text-ink-3">{note}</span>
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={go} loading={file.isPending} leftIcon={<IconDownload aria-hidden="true" className="size-4" strokeWidth={2} />}>Export {name}</Button>
      </div>
    </Modal>
  )
}
