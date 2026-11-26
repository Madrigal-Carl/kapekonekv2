import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { IconImage, IconPlay, IconVideo, IconX } from '@/components/ui/icons'
import { Spinner } from '@/components/ui/Spinner'
import { useCreatePost, useUpdatePost } from '@/hooks/usePosts'
import { useUploadImage } from '@/hooks/useUploads'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { squareUrl } from '@/lib/image'
import { POST_MEDIA_MAX, POST_TAGS, postBodyRule } from '@/schemas/rules'
import { useMe } from '@/hooks/useMe'

/** `#tag` pill: picked = roast, the rest disable once 3 are picked (Hub.dc.html). */
export function TagChip({ tag, pressed, disabled, onClick, size = 'sm', tone = 'roast', children }) {
  const on = tone === 'roast' ? 'border-roast bg-roast text-white' : 'border-espresso bg-espresso text-white'
  return (
    <Button
      variant="bare"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 font-semibold disabled:opacity-45',
        size === 'sm' ? 'min-h-8 text-[12.5px]' : 'min-h-[34px] text-[13px]',
        pressed ? on : 'border-sand-strong bg-white text-ink hover:bg-cream',
      )}
    >
      {children ?? `#${tag}`}
    </Button>
  )
}

const pickerButton = 'h-[38px] gap-1.5 px-3 text-[13px] font-normal'

/**
 * Create a Hub post, or edit one (`post`): text, up to 3 tags, up to 10 photos or videos (Hub.dc.html composer).
 * New posts start collapsed and expand on focus; editing starts expanded with Cancel / Save changes.
 * @param {{ post?: object, onDone?: (message: string) => void, onCancel?: () => void }} props
 */
export function PostComposer({ post, onDone, onCancel }) {
  const me = useMe()
  const editing = Boolean(post)
  const [open, setOpen] = useState(editing)
  const [draft, setDraft] = useState(post?.body ?? '')
  const [tags, setTags] = useState(post?.tags ?? [])
  const [media, setMedia] = useState(post?.media ?? [])
  const [uploading, setUploading] = useState(0)
  const photo = useRef(null)
  const video = useRef(null)
  const upload = useUploadImage('post_media')
  const create = useCreatePost()
  const update = useUpdatePost()
  const saving = create.isPending || update.isPending
  const composing = open || Boolean(draft)

  async function onPick(e) {
    const files = [...(e.target.files ?? [])].slice(0, POST_MEDIA_MAX - media.length)
    e.target.value = ''
    if (e.target.files?.length > files.length) toast.error(`Add up to ${POST_MEDIA_MAX} photos or videos`)
    for (const file of files) {
      setUploading((n) => n + 1)
      try {
        const uploaded = await upload.mutateAsync({ file })
        setMedia((m) => [...m, { ...uploaded, type: file.type.startsWith('video/') ? 'video' : 'image', preview: URL.createObjectURL(file) }])
      } catch (error) {
        toast.error(errorMessage(error))
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  function submit() {
    const parsed = postBodyRule.safeParse(draft)
    if (!parsed.success) return toast.error(parsed.error.issues[0].message)
    const body = { body: parsed.data, tags, media: media.map(({ url, publicId, alt }) => ({ url, publicId, alt })) }
    const onError = (error) => toast.error(errorMessage(error))
    if (editing) return update.mutate({ id: post._id, ...body }, { onSuccess: () => onDone?.('Post updated.'), onError })
    return create.mutate(body, {
      onSuccess: () => {
        setDraft('')
        setTags([])
        setMedia([])
        setOpen(false)
        onDone?.('Posted to the Hub.')
      },
      onError,
    })
  }

  const fields = (
    <div className={cn('flex flex-col gap-2.5', !editing && 'ml-[54px] mt-3 max-[480px]:ml-0')}>
      <div>
        <span className="block text-xs font-semibold text-ink-2">
          Tags <span className="font-normal text-ink-3">· up to 3 · {tags.length}/3</span>
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {POST_TAGS.map((tag) => {
            const on = tags.includes(tag)
            return (
              <TagChip key={tag} tag={tag} pressed={on} disabled={!on && tags.length >= 3} onClick={() => setTags(on ? tags.filter((t) => t !== tag) : [...tags, tag])} />
            )
          })}
        </div>
      </div>
      {(media.length > 0 || uploading > 0) && (
        <ul aria-label="Attached photos and videos" className="m-0 flex list-none flex-wrap gap-2 p-0">
          {media.map((item, i) => (
            <li key={item.url} className="relative size-16 overflow-hidden rounded-[6px] border border-sand bg-photo">
              {item.type === 'video' ? (
                <span className="grid size-full place-items-center bg-espresso-2 text-white"><IconPlay aria-hidden="true" className="size-4 fill-current" strokeWidth={0} /></span>
              ) : (
                <img src={item.preview ?? squareUrl(item.url, 64)} alt={item.alt ?? ''} className="size-full object-cover" />
              )}
              <Button
                variant="bare"
                aria-label={`Remove ${item.type === 'video' ? 'video' : 'photo'} ${i + 1}`}
                onClick={() => setMedia(media.filter((m) => m !== item))}
                className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full border-0 bg-white/92 p-0 text-ink"
              >
                <IconX aria-hidden="true" className="size-3.5" strokeWidth={2.2} />
              </Button>
            </li>
          ))}
          {uploading > 0 && (
            <li className="grid size-16 place-items-center rounded-[6px] border border-dashed border-sand-strong" aria-label="Uploading">
              <Spinner className="size-4" />
            </li>
          )}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" disabled={media.length >= POST_MEDIA_MAX} onClick={() => photo.current?.click()} leftIcon={<IconImage aria-hidden="true" className="size-4 text-success" strokeWidth={2} />} className={pickerButton}>Photo</Button>
          <Button variant="outline" disabled={media.length >= POST_MEDIA_MAX} onClick={() => video.current?.click()} leftIcon={<IconVideo aria-hidden="true" className="size-4 text-danger-strong" strokeWidth={2} />} className={pickerButton}>Video</Button>
          <span className="text-[11.5px] text-ink-3">Up to 10 · photos 5 MB, videos 50 MB</span>
          <input ref={photo} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden onChange={onPick} />
          <input ref={video} type="file" accept="video/mp4,video/webm" multiple hidden onChange={onPick} />
        </div>
        <div className="flex gap-2">
          {editing && <Button variant="outline" onClick={onCancel} className="h-10">Cancel</Button>}
          <Button onClick={submit} disabled={!draft.trim() || uploading > 0} loading={saving} className="h-10 px-[18px]">{editing ? 'Save changes' : 'Post'}</Button>
        </div>
      </div>
    </div>
  )

  if (editing) {
    return (
      <div className="mx-[18px] mt-3 flex flex-col gap-2.5">
        <label className="sr-only" htmlFor={`edit-${post._id}`}>Edit your post</label>
        <textarea
          id={`edit-${post._id}`}
          rows={4}
          value={draft}
          maxLength={5000}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          className="w-full resize-y rounded-[10px] border border-sand-strong bg-cream px-3.5 py-[11px] text-sm focus:border-roast focus:outline-none focus:ring-[3px] focus:ring-roast/20"
        />
        {fields}
      </div>
    )
  }

  return (
    <section aria-label="Create a post" className="rounded-[10px] border border-sand bg-white px-[18px] py-4">
      <div className="flex gap-3">
        <Avatar person={me} className="size-[42px] text-[13px]" />
        <label htmlFor="newpost" className="sr-only">Share an update</label>
        <textarea
          id="newpost"
          rows={composing ? 3 : 1}
          value={draft}
          maxLength={5000}
          onFocus={() => setOpen(true)}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share an update, tip or question with the community…"
          className="min-w-0 flex-1 resize-y rounded-[10px] border border-sand-strong bg-cream px-3.5 py-[11px] text-sm focus:border-roast focus:outline-none focus:ring-[3px] focus:ring-roast/20"
        />
      </div>
      {composing && fields}
    </section>
  )
}
