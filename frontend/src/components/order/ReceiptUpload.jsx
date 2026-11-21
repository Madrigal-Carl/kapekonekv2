import { ImageUp } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FieldHint } from '@/components/ui/Input'
import { useUploadImage } from '@/hooks/useUploads'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_BYTES = 5 * 1024 * 1024
const sizeText = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

/**
 * "Payment receipt · required" upload (Checkout.dc.html). Uploads straight to Cloudinary with a signed request.
 * @param {{ value: { url: string, publicId: string, name?: string, size?: number } | null, onChange: (receipt: object|null) => void, error?: string }} props
 */
export function ReceiptUpload({ value, onChange, error }) {
  const id = useId()
  const input = useRef(null)
  const upload = useUploadImage('receipt')
  const [fileError, setFileError] = useState(null)
  const uploadError = upload.isError ? (upload.error.response ? errorMessage(upload.error) : upload.error.message) : null
  const localError = fileError ?? uploadError

  const choose = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    upload.reset()
    setFileError(!TYPES.includes(file.type) ? 'Choose a JPG, PNG, WebP or HEIC image.' : file.size > MAX_BYTES ? 'That file is over 5 MB. Choose a smaller one.' : null)
    if (!TYPES.includes(file.type) || file.size > MAX_BYTES) return
    onChange(null)
    upload.mutate({ file }, { onSuccess: (receipt) => onChange({ ...receipt, name: file.name, size: file.size }) })
  }

  return (
    <div>
      <span id={`${id}-label`} className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">
        Payment receipt · required
      </span>
      <input ref={input} id={`${id}-file`} type="file" accept={TYPES.join(',')} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} onChange={choose} className="sr-only" />
      {value ? (
        <div className="mt-2 flex items-center gap-3 rounded-card border border-sand p-3">
          <img src={value.url} alt="Your payment receipt" className="size-14 shrink-0 rounded-[6px] bg-photo object-cover" />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold">{value.name ?? 'Receipt'}</span>
            {value.size && <span className="block text-xs text-ink-3">{sizeText(value.size)} · uploaded</span>}
          </div>
          <Button variant="outline" onClick={() => input.current.click()} className="min-h-10 px-3 py-2 text-[13px]">
            Replace
          </Button>
        </div>
      ) : (
        <label
          htmlFor={`${id}-file`}
          className={cn(
            'mt-2 flex cursor-pointer flex-col items-center gap-1.5 rounded-card border-[1.5px] border-dashed p-[22px] text-center text-[13px] text-ink-3 focus-within:outline-2 focus-within:outline-roast hover:bg-cream',
            error || localError ? 'border-danger-strong' : 'border-sand-strong',
          )}
        >
          <ImageUp aria-hidden="true" className="size-[22px] text-roast" strokeWidth={1.75} />
          {upload.isPending ? (
            <span aria-live="polite">Uploading… {upload.progress}%</span>
          ) : (
            <span>
              <strong className="text-roast">Upload your receipt</strong> · JPG, PNG or WebP, up to 5 MB
            </span>
          )}
        </label>
      )}
      <FieldHint id={`${id}-hint`} error={localError ?? error} />
    </div>
  )
}
