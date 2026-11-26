import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { IconAttach, IconCheck, IconSend, IconX } from '@/components/ui/icons'
import { useEditMessage, useSendMessage } from '@/hooks/useInbox'
import { useUploadImage } from '@/hooks/useUploads'
import { errorMessage } from '@/lib/applyServerErrors'
import { emitSocket } from '@/lib/socket'
import { messageBodyRule } from '@/schemas/rules'

const TYPING_THROTTLE_MS = 3000

/**
 * The composer (DESIGN §8.2 Composer): reply or edit context, attach, the message box and Send.
 * Enter sends, Shift+Enter adds a line. A picked photo or PDF is uploaded and sent as its own message.
 * @param {{ chat: object, replyTo: object|null, editing: object|null, onDone: () => void }} props
 */
export function Composer({ chat, replyTo, editing, onDone }) {
  // Remounted per edit (its key), so an edit starts from the message and leaving it starts empty.
  const [draft, setDraft] = useState(editing?.body ?? '')
  const box = useRef(null)
  const file = useRef(null)
  const lastTyping = useRef(0)
  const send = useSendMessage()
  const edit = useEditMessage()
  const upload = useUploadImage('message_attachment')

  useEffect(() => {
    if (editing || replyTo) box.current?.focus()
  }, [editing, replyTo])
  // Grow with the text, up to 120px (then it scrolls).
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [draft])

  const onError = (error) => toast.error(errorMessage(error))

  function submit() {
    const parsed = messageBodyRule.safeParse(draft)
    if (!parsed.success) return toast.error(parsed.error.issues[0].message)
    if (!parsed.data) return undefined
    if (editing) {
      return edit.mutate({ id: editing.id, body: parsed.data }, { onSuccess: onDone, onError })
    }
    return send.mutate(
      { conversationId: chat.id, body: parsed.data, attachments: [], replyTo: replyTo?.id ?? null },
      {
        onSuccess: () => {
          setDraft('')
          onDone()
        },
        onError,
      },
    )
  }

  function onInput(e) {
    setDraft(e.target.value)
    if (!editing && Date.now() - lastTyping.current > TYPING_THROTTLE_MS) {
      lastTyping.current = Date.now()
      emitSocket('typing', { conversationId: chat.id })
    }
  }

  async function onPick(e) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    try {
      const uploaded = await upload.mutateAsync({ file: picked })
      await send.mutateAsync({ conversationId: chat.id, body: '', attachments: [uploaded], replyTo: replyTo?.id ?? null })
      onDone()
    } catch (error) {
      onError(error)
    }
  }

  const context = editing
    ? { title: 'Editing message', text: 'Edits are allowed for 15 minutes after sending.' }
    : replyTo && { title: `Replying to ${replyTo.mine ? 'You' : replyTo.author}`, text: replyTo.text }
  const busy = send.isPending || edit.isPending

  return (
    <div className="border-t border-sand-soft bg-white px-3.5 pb-3.5 pt-2.5 max-[960px]:px-2.5">
      {context && (
        <div className="mb-2 flex items-center gap-2.5 rounded-[4px] border-l-[3px] border-caramel bg-highlight px-2.5 py-2 text-[12.5px]">
          <span className="min-w-0 flex-1">
            <strong>{context.title}</strong>
            <span className="block truncate text-ink-3">{context.text}</span>
          </span>
          <Button variant="bare" aria-label="Cancel" onClick={onDone} className="grid size-[30px] place-items-center text-ink-3">
            <IconX aria-hidden="true" className="size-4" strokeWidth={2} />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        {!editing && (
          <>
            <Button variant="ghost" iconOnly aria-label="Attach a photo or file" loading={upload.isPending} onClick={() => file.current?.click()} className="size-[42px] rounded-full">
              <IconAttach aria-hidden="true" className="size-[19px]" strokeWidth={2} />
            </Button>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" onChange={onPick} className="hidden" tabIndex={-1} aria-hidden="true" />
          </>
        )}
        <label htmlFor="inbox-composer" className="sr-only">
          Message
        </label>
        <textarea
          ref={box}
          id="inbox-composer"
          rows={1}
          value={draft}
          onChange={onInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={editing ? 'Edit your message' : 'Write a message'}
          className="max-h-[120px] min-h-[42px] flex-1 resize-none rounded-[21px] border border-sand-strong px-4 py-2.5 text-[13.5px] leading-[1.45] outline-none focus:border-roast focus:ring-[3px] focus:ring-roast/20"
        />
        <Button iconOnly aria-label={editing ? 'Save edit' : 'Send'} loading={busy} onClick={submit} className="size-[42px] rounded-full">
          {editing ? <IconCheck aria-hidden="true" className="size-[18px]" strokeWidth={2} /> : <IconSend aria-hidden="true" className="size-[18px]" strokeWidth={2} />}
        </Button>
      </div>
    </div>
  )
}
