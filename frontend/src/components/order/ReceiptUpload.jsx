import { useId, useState } from 'react'
import { FileDrop } from '@/components/ui/FileDrop'
import { FieldHint } from '@/components/ui/Input'
import { useUploadImage } from '@/hooks/useUploads'
import { errorMessage } from '@/lib/applyServerErrors'
import { problemText } from '@/lib/fileCheck'
import { imageUrl } from '@/lib/image'

const sizeText = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const TIP = 'Try a screenshot instead.'

/**
 * "Payment receipt · required" upload (Checkout.dc.html). Uploads straight to Cloudinary with a signed request.
 * @param {{ value: { url: string, publicId: string, name?: string, size?: number } | null, onChange: (receipt: object|null) => void, error?: string }} props
 */
export function ReceiptUpload({ value, onChange, error }) {
  const id = useId()
  const upload = useUploadImage('receipt')
  const [problem, setProblem] = useState(null)
  const shown = problem ?? (upload.isError ? (upload.error.response ? errorMessage(upload.error) : upload.error.message) : null)

  const take = (file) => {
    upload.reset()
    onChange(null)
    upload.mutate({ file }, { onSuccess: (receipt) => onChange({ ...receipt, name: file.name, size: file.size }) })
  }
  const drop = { kind: 'image', onFile: take, onError: setProblem, tip: TIP, busy: upload.isPending, describedBy: `${id}-label ${id}-hint` }

  return (
    <div>
      <span id={`${id}-label`} className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">
        Payment receipt · required
      </span>
      {value ? (
        <div className="mt-2 flex items-center gap-3 rounded-card border border-sand p-3">
          <img src={imageUrl(value.url, 56)} alt="Your payment receipt" className="size-14 shrink-0 rounded-[6px] bg-photo object-cover" />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold">{value.name ?? 'Receipt'}</span>
            {value.size && <span className="block text-xs text-ink-3">{sizeText(value.size)} · uploaded</span>}
          </div>
          <FileDrop {...drop} className="inline-flex min-h-10 items-center rounded-control border border-sand-strong bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-cream">
            Replace
          </FileDrop>
        </div>
      ) : (
        <FileDrop
          {...drop}
          className="mt-2"
          title="Upload your receipt"
          hint="JPG, PNG or WebP, up to 5 MB"
          busyText={`Uploading… ${upload.progress}%`}
          error={shown}
          invalid={Boolean(error)}
        />
      )}
      <FieldHint id={`${id}-hint`} error={value ? problemText(shown) : shown ? null : error} />
    </div>
  )
}
