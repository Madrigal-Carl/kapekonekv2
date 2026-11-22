import { Upload } from 'lucide-react'
import { useId, useState } from 'react'
import { useUploadImage } from '@/hooks/useUploads'
import { cn } from '@/lib/cn'
import { extension } from '@/lib/fileCheck'
import { formatMegabytes } from '@/schemas/rules'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'

/**
 * A farmer document (valid ID or land proof): a dashed upload tile, then the file with Replace (AssociationModal.dc.html).
 * Uploads straight to Cloudinary; `onChange` gets `{ url, publicId, name, bytes, ext }`.
 * @param {{ label: string, short: string, value: object | null, onChange: (doc: object) => void, compact?: boolean, error?: string }} props
 */
export function DocumentUpload({ label, short, value, onChange, compact = false, error }) {
  const id = useId()
  const upload = useUploadImage('farmer_document')
  const [problem, setProblem] = useState(null)

  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProblem(null)
    upload.mutate(
      { file },
      {
        onSuccess: (ref) => onChange({ ...ref, name: file.name, bytes: file.size, ext: extension(file).toUpperCase() }),
        onError: (e) => setProblem(e.message || 'Upload failed. Try again.'),
      },
    )
  }
  const input = <input type="file" accept={ACCEPT} aria-label={`Upload ${short}`} aria-describedby={`${id}-e`} disabled={upload.isPending} onChange={pick} className="sr-only" />
  const message = problem ?? error

  return (
    <div>
      {!compact && <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">{label}</span>}
      {value ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-sand p-2.5">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-md bg-photo text-[10px] font-bold text-caramel-ink">{value.ext}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{value.name}</span>
            <span className="block text-[11.5px] text-ink-3">{value.bytes ? `${formatMegabytes(value.bytes)} · ${value.ext === 'PDF' ? 'PDF' : 'image'}` : value.ext}</span>
          </span>
          <label className="relative inline-flex min-h-9 cursor-pointer items-center text-[12.5px] font-semibold text-roast focus-within:outline-2 focus-within:outline-roast">
            {upload.isPending ? 'Uploading…' : 'Replace'}
            {input}
          </label>
        </div>
      ) : (
        <label
          className={cn(
            'relative mt-2 flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border-[1.5px] border-dashed bg-white text-center text-[12.5px] text-ink-3 hover:bg-cream focus-within:outline-2 focus-within:outline-roast',
            compact ? 'px-3 py-3.5' : 'px-3 py-[18px]',
            message ? 'border-danger-strong' : 'border-sand-strong',
            upload.isPending && 'pointer-events-none opacity-70',
          )}
        >
          <Upload aria-hidden="true" className="size-5 text-roast" strokeWidth={1.75} />
          {upload.isPending ? (
            <span aria-live="polite">Uploading… {upload.progress}%</span>
          ) : (
            <span>
              <strong className="text-roast">Upload {short}</strong>
              <br />
              {compact ? 'Photo 5 MB · PDF 10 MB' : 'Photo up to 5 MB or PDF up to 10 MB'}
            </span>
          )}
          {input}
        </label>
      )}
      <span id={`${id}-e`} role={message ? 'alert' : undefined} className="mt-1 block text-xs text-danger-ink">{message}</span>
    </div>
  )
}
