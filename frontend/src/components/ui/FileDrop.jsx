import { IconCircleAlert, IconFileText, IconImageUp } from '@/components/ui/icons'

import { useId, useState } from 'react'
import { cn } from '@/lib/cn'
import { checkFile } from '@/lib/fileCheck'
import { UPLOAD_RULES } from '@/schemas/rules'

/**
 * File picker that checks type and size against `UPLOAD_RULES[kind]` before anything uploads (Components.dc.html,
 * "Upload rules"). A good file goes to `onFile`; a bad one to `onError({ title, detail })` (`onError(null)` clears it).
 * Without children it is the dashed drop zone, drawn red with `error`; with children it is a plain trigger
 * (`className` styles it) and the parent shows the error.
 * @param {{
 *   kind: 'image'|'file', onFile: (file: File) => void, onError?: (problem: { title: string, detail: string } | null) => void,
 *   error?: { title: string, detail: string } | string | null, invalid?: boolean, busy?: boolean, busyText?: string,
 *   title?: string, hint?: string, tip?: string, describedBy?: string, className?: string, children?: React.ReactNode,
 * }} props
 */
export function FileDrop({ kind, onFile, onError, error, invalid, busy = false, busyText, title, hint, tip, describedBy, className, children }) {
  const id = useId()
  const [over, setOver] = useState(false)
  const take = (file) => {
    if (!file || busy) return
    const problem = checkFile(kind, file, tip)
    onError?.(problem)
    if (!problem) onFile(file)
  }
  const field = (
    <input
      id={id}
      type="file"
      accept={UPLOAD_RULES[kind].mimeTypes.join(',')}
      disabled={busy}
      aria-describedby={describedBy}
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        take(file)
      }}
      className="sr-only"
    />
  )
  if (children) {
    return (
      <label className={cn('relative cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-roast', busy && 'pointer-events-none opacity-60', className)}>
        {children}
        {field}
      </label>
    )
  }

  const Icon = kind === 'image' ? IconImageUp : IconFileText
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files?.[0])
      }}
      className={cn(
        'relative flex cursor-pointer flex-col items-center gap-1.5 rounded-card border-[1.5px] border-dashed p-[22px] text-center text-[13px] text-ink-3 focus-within:outline-2 focus-within:outline-roast hover:bg-cream',
        error ? 'border-danger-strong bg-danger-soft hover:bg-danger-soft' : invalid ? 'border-danger-strong' : 'border-sand-strong',
        over && 'bg-cream',
        className,
      )}
    >
      {busy ? (
        <span aria-live="polite">{busyText ?? 'Uploading…'}</span>
      ) : error ? (
        <>
          <IconCircleAlert aria-hidden="true" className="size-5 text-danger-ink" strokeWidth={1.75} />
          <span role="alert" className="text-danger-ink">
            {typeof error === 'string' ? error : (
              <>
                <strong>{error.title}</strong>
                <br />
                {error.detail}
              </>
            )}
          </span>
        </>
      ) : (
        <>
          <Icon aria-hidden="true" className="size-[22px] text-roast" strokeWidth={1.75} />
          <span>
            <strong className="text-roast">{title}</strong> · {hint ?? UPLOAD_RULES[kind].hint}
          </span>
        </>
      )}
      {field}
    </label>
  )
}
