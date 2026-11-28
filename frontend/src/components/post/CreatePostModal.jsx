import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { IconHash, IconImage, IconPlay, IconPlus, IconUsers, IconX } from '@/components/ui/icons'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useMe } from '@/hooks/useMe'
import { useCreatePost, useUpdatePost } from '@/hooks/usePosts'
import { useUploadImage } from '@/hooks/useUploads'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { squareUrl } from '@/lib/image'
import { POST_MAX, POST_MEDIA_MAX, POST_TAGS, postBodyRule } from '@/schemas/rules'
import { LengthHint } from './LengthHint'
import { useMentions } from '@/hooks/useMentions'
import { MentionList, MentionNote } from './Mentions'
import { TagChip } from './TagChip'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm'
const roundClose = 'grid size-9 place-items-center rounded-full border-0 bg-foam p-0 text-ink-2 hover:bg-sand-soft'
const toolButton = 'grid size-10 place-items-center rounded-full border-0 p-0'
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * "Create post" / "Edit post" (HubCreatePost.dc.html, HubMobileCreate.dc.html): author row with the audience chip, a borderless
 * textarea, the dropzone, a media grid with remove buttons, tag chips and picker, the "Add to your post" bar and a full-width Post.
 * Full screen on phones. Closing with unsaved changes asks first. Mount it when it opens (its state starts fresh each time).
 * @param {{ post?: object, start?: 'text'|'media'|'tags', onClose: () => void, onDone: (message: string) => void }} props
 */
export function CreatePostModal({ post, start = 'text', onClose, onDone }) {
  const me = useMe()
  const id = useId()
  const editing = Boolean(post)
  const [draft, setDraft] = useState(post?.body ?? '')
  const [tags, setTags] = useState(post?.tags ?? [])
  const [media, setMedia] = useState(post?.media ?? [])
  const [drop, setDrop] = useState(start === 'media')
  const [tagPick, setTagPick] = useState(start === 'tags')
  const [uploading, setUploading] = useState(0)
  const [discarding, setDiscarding] = useState(false)
  const text = useRef(null)
  const file = useRef(null)
  const upload = useUploadImage('post_media')
  const create = useCreatePost()
  const update = useUpdatePost()
  const mention = useMentions(draft, setDraft, text, post?.mentions)

  const tooLong = draft.trim().length > POST_MAX
  // The API needs text on every post (postBodyRule), so media alone doesn't enable Post.
  const canPost = Boolean(draft.trim()) && !tooLong && uploading === 0
  const dirty = editing
    ? draft !== post.body || !same(tags, post.tags) || !same(media.map((m) => m.url), post.media.map((m) => m.url))
    : Boolean(draft.trim() || tags.length || media.length || uploading)
  const roomy = !media.length && !drop
  const close = () => (dirty ? setDiscarding(true) : onClose())

  async function addFiles(list) {
    const files = [...(list ?? [])]
    const room = POST_MEDIA_MAX - media.length - uploading
    if (files.length > room) toast.error(`Add up to ${POST_MEDIA_MAX} photos or videos`)
    for (const picked of files.slice(0, Math.max(0, room))) {
      setUploading((n) => n + 1)
      try {
        const uploaded = await upload.mutateAsync({ file: picked })
        setMedia((m) => [...m, { ...uploaded, type: picked.type.startsWith('video/') ? 'video' : 'image', preview: URL.createObjectURL(picked) }])
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
    const body = { body: parsed.data, tags, mentions: mention.ids(parsed.data), media: media.map(({ url, publicId, alt }) => ({ url, publicId, alt })) }
    const onError = (error) => toast.error(errorMessage(error))
    if (editing) return update.mutate({ id: post._id, ...body }, { onSuccess: () => onDone('Post updated.'), onError })
    return create.mutate(body, { onSuccess: () => onDone('Posted to the Hub.'), onError })
  }

  return (
    <>
      <Modal
        open
        onClose={close}
        labelledBy={`${id}-t`}
        initialFocus={start === 'text' ? text : undefined}
        className={cn(
          'fixed left-1/2 top-14 flex max-h-[calc(100vh-88px)] w-[560px] max-w-[calc(100%-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-[10px] border-0 shadow-[0_30px_60px_-24px_rgba(43,26,18,0.55)]',
          'max-[720px]:inset-0 max-[720px]:h-dvh max-[720px]:max-h-none max-[720px]:w-full max-[720px]:max-w-none max-[720px]:translate-x-0 max-[720px]:rounded-none',
        )}
      >
        <header className="relative shrink-0 border-b border-sand-soft px-[60px] py-4 text-center">
          <h2 id={`${id}-t`} className="text-lg font-semibold">{editing ? 'Edit post' : 'Create post'}</h2>
          <Button variant="bare" aria-label="Close" onClick={close} className={cn(roundClose, 'absolute right-3 top-1/2 -translate-y-1/2')}>
            <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] py-4">
          <div className="flex items-center gap-3">
            <Avatar person={me} className="size-[42px] text-[13px]" />
            <div>
              <span className="block text-[14.5px] font-semibold">{me.name}</span>
              <span className="mt-0.5 inline-flex items-center gap-[5px] rounded-[5px] bg-foam px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">
                <IconUsers aria-hidden="true" className="size-3" strokeWidth={2} />Hub · farmers, Group Managers, Kaluppa
              </span>
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-text`} className="sr-only">Post text</label>
            <textarea
              ref={text}
              id={`${id}-text`}
              rows={roomy ? 5 : 3}
              value={draft}
              aria-invalid={tooLong}
              aria-describedby={`${id}-len`}
              {...mention.inputProps(`${id}-mentions`)}
              onKeyDown={mention.onKeyDown}
              placeholder={`What’s on your mind, ${me.firstName}?`}
              className={cn(
                'w-full resize-none border-0 bg-transparent p-0 leading-[1.5] text-ink outline-none placeholder:text-ink-3',
                roomy && draft.length <= 120 ? 'text-[19px]' : 'text-[15px]',
              )}
            />
            <LengthHint id={`${id}-len`} value={draft} max={POST_MAX} />
            <MentionList id={`${id}-mentions`} mention={mention} className="mt-1" />
            <MentionNote mention={mention} className="mt-1" />
          </div>

          {drop && !media.length && (
            <div
              className="relative rounded-lg border border-sand p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                addFiles(e.dataTransfer.files)
              }}
            >
              <Button variant="bare" onClick={() => file.current?.click()} className="flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-[6px] border-0 bg-foam text-ink hover:bg-crema">
                <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-sand text-ink-2">
                  {uploading ? <Spinner className="size-5" /> : <IconImage className="size-5" strokeWidth={2} />}
                </span>
                <span className="text-[15px] font-semibold">Add photos or videos</span>{' '}
                <span className="text-[12.5px] text-ink-3">or drag and drop · up to {POST_MEDIA_MAX} · photos 5 MB, videos 50 MB</span>
              </Button>
              <Button variant="bare" aria-label="Close photo upload" onClick={() => setDrop(false)} className="absolute right-3.5 top-3.5 grid size-[30px] place-items-center rounded-full border border-sand bg-white p-0 text-ink-2">
                <IconX aria-hidden="true" className="size-4" strokeWidth={2.2} />
              </Button>
            </div>
          )}

          {(media.length > 0 || uploading > 0) && (
            <div className="rounded-lg border border-sand p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2.5">
                <span className="text-[12.5px] text-ink-2"><strong>{media.length}</strong> of {POST_MEDIA_MAX}</span>
                <Button variant="outline" size="sm" disabled={media.length + uploading >= POST_MEDIA_MAX} onClick={() => file.current?.click()} leftIcon={<IconPlus aria-hidden="true" className="size-3.5" strokeWidth={2.2} />} className="min-h-8 px-2.5 text-[12.5px]">
                  Add more
                </Button>
              </div>
              <ul aria-label="Photos and videos in this post" className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5 p-0">
                {media.map((item, i) => {
                  const label = `${item.type === 'video' ? 'video' : 'photo'} ${i + 1}`
                  return (
                    <li key={item.url} className="relative aspect-square overflow-hidden rounded-[6px] bg-photo">
                      {item.type === 'video' && !item.posterUrl ? (
                        <span className="grid size-full place-items-center bg-espresso-2 text-white"><IconPlay aria-hidden="true" className="size-5 fill-current" strokeWidth={0} /></span>
                      ) : (
                        <img src={item.preview && item.type !== 'video' ? item.preview : squareUrl(item.posterUrl ?? item.url, 96)} alt={item.alt || `Post ${label}`} className="size-full object-cover" />
                      )}
                      {item.type === 'video' && item.posterUrl && (
                        <span aria-hidden="true" className="absolute bottom-1.5 left-1.5 rounded bg-media/70 px-1.5 py-0.5 text-[10px] text-white"><IconPlay className="inline size-2.5 fill-current" strokeWidth={0} /></span>
                      )}
                      <Button variant="bare" aria-label={`Remove ${label}`} onClick={() => setMedia(media.filter((m) => m !== item))} className="absolute right-[5px] top-[5px] grid size-[26px] place-items-center rounded-full border-0 bg-white/92 p-0 text-ink">
                        <IconX aria-hidden="true" className="size-3.5" strokeWidth={2.2} />
                      </Button>
                    </li>
                  )
                })}
                {uploading > 0 && (
                  <li aria-label="Uploading" className="grid aspect-square place-items-center rounded-[6px] border border-dashed border-sand-strong"><Spinner className="size-4" /></li>
                )}
              </ul>
            </div>
          )}

          {tags.length > 0 && (
            <ul aria-label="Tags on this post" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {tags.map((tag) => (
                <li key={tag} className="inline-flex min-h-[30px] items-center gap-1 rounded-full bg-crema pl-3 pr-1.5 text-[12.5px] font-semibold text-roast">
                  #{tag}
                  <Button variant="bare" aria-label={`Remove tag ${tag}`} onClick={() => setTags(tags.filter((t) => t !== tag))} className="grid size-[22px] place-items-center rounded-full border-0 bg-transparent p-0 text-roast">
                    <IconX aria-hidden="true" className="size-3" strokeWidth={2.4} />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {tagPick && (
            <div className="rounded-lg border border-sand p-3">
              <span id={`${id}-tags`} className="block text-[12.5px] font-semibold text-ink-2">
                Pick tags <span className="font-normal text-ink-3">· up to 3 · {tags.length}/3</span>
              </span>
              <div role="group" aria-labelledby={`${id}-tags`} className="mt-2 flex flex-wrap gap-1.5">
                {POST_TAGS.map((tag) => {
                  const on = tags.includes(tag)
                  return <TagChip key={tag} tag={tag} pressed={on} disabled={!on && tags.length >= 3} onClick={() => setTags(on ? tags.filter((t) => t !== tag) : [...tags, tag])} />
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-sand-soft px-[18px] pb-4 pt-3">
          <div className="flex items-center justify-between gap-2.5 rounded-lg border border-sand-strong py-1.5 pl-3.5 pr-2">
            <span className="text-sm font-semibold">Add to your post</span>
            <span className="flex gap-0.5">
              <Button
                variant="bare"
                aria-label="Add photos or videos"
                aria-pressed={drop || media.length > 0}
                onClick={() => (media.length ? file.current?.click() : setDrop((d) => !d))}
                className={cn(toolButton, drop || media.length ? 'bg-tone-green-bg' : 'bg-transparent hover:bg-foam')}
              >
                <IconImage aria-hidden="true" className="size-5 text-success" strokeWidth={2} />
              </Button>
              <Button variant="bare" aria-label="Add tags" aria-pressed={tagPick} onClick={() => setTagPick((t) => !t)} className={cn(toolButton, tagPick ? 'bg-crema' : 'bg-transparent hover:bg-foam')}>
                <IconHash aria-hidden="true" className="size-5 text-roast" strokeWidth={2} />
              </Button>
              <Button variant="bare" aria-label="Mention someone" onClick={mention.start} className={cn(toolButton, 'bg-transparent text-[19px] font-bold text-tone-blue-ink hover:bg-foam')}>
                @
              </Button>
            </span>
          </div>
          <Button onClick={submit} disabled={!canPost} loading={create.isPending || update.isPending} className="min-h-11 w-full text-[14.5px] disabled:bg-sand-soft disabled:text-ink-4 disabled:opacity-100">
            {editing ? 'Save' : 'Post'}
          </Button>
        </div>
        <input
          ref={file}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </Modal>
      <ConfirmModal
        open={discarding}
        variant="discard"
        title={editing ? 'Discard your changes?' : 'Discard this post?'}
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        onClose={() => setDiscarding(false)}
        onConfirm={onClose}
      >
        {editing ? 'Your post stays as it was.' : 'You’ll lose what you wrote and the photos you added.'}
      </ConfirmModal>
    </>
  )
}
