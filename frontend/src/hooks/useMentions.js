import { useState } from 'react'
import { usePeople } from '@/hooks/useInbox'

// Hub @mentions (Change 08). The list is the Inbox's people: the same scope the server checks.
const AT_QUERY = /(^|\s)@([^\s@]*)$/

/**
 * Mention state for one text box: the open list while the word before the caret starts with `@`, ↑ ↓ Enter to pick,
 * Esc to close. A pick inserts `@Full Name `. `ids(text)` sends only the people whose name is still in the text.
 * @param {string} text
 * @param {(next: string) => void} setText
 * @param {React.RefObject<HTMLTextAreaElement|HTMLInputElement>} inputRef
 * @param {Array<{ _id: string, name: string }>} [initial] mentions already on the post or comment
 */
export function useMentions(text, setText, inputRef, initial = []) {
  const [picked, setPicked] = useState(() => initial.map((m) => ({ id: m._id, name: m.name })))
  const [caret, setCaret] = useState(null)
  const [active, setActive] = useState(0)
  const [closedAt, setClosedAt] = useState(null)
  const before = text.slice(0, caret ?? text.length)
  const match = AT_QUERY.exec(before)
  const at = match ? before.length - match[2].length - 1 : -1
  const open = Boolean(match) && closedAt !== at
  const people = usePeople(match?.[2] ?? '', open)
  const options = open ? (people.data ?? []).slice(0, 5) : []

  const pick = (person) => {
    const insert = `@${person.name} `
    setText(text.slice(0, at) + insert + text.slice(before.length))
    setPicked((list) => [...list.filter((p) => p.id !== person.id), { id: person.id, name: person.name }])
    setActive(0)
    const to = at + insert.length
    setCaret(to)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(to, to)
    })
  }
  /** Type `@` at the caret (the Create post modal's @ button). */
  const start = () => {
    const end = caret ?? text.length
    const add = end > 0 && !/\s$/.test(text.slice(0, end)) ? ' @' : '@'
    setText(text.slice(0, end) + add + text.slice(end))
    setCaret(end + add.length)
    setClosedAt(null)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(end + add.length, end + add.length)
    })
  }
  /** Returns true when the key was for the list (the caller then skips its own Enter / Esc). */
  const onKeyDown = (e) => {
    if (!open) return false
    if (e.key === 'Escape') setClosedAt(at)
    else if (!options.length) return false
    else if (e.key === 'ArrowDown') setActive((i) => (i + 1) % options.length)
    else if (e.key === 'ArrowUp') setActive((i) => (i - 1 + options.length) % options.length)
    else if (e.key === 'Enter' || e.key === 'Tab') pick(options[Math.min(active, options.length - 1)])
    else return false
    e.preventDefault()
    e.stopPropagation()
    return true
  }
  const track = (e) => {
    setCaret(e.target.selectionStart)
    setActive(0)
  }
  const named = picked.filter((p) => text.includes(`@${p.name}`))
  return {
    open, options, active, pick, start, onKeyDown, named, query: match?.[2] ?? '', pending: people.isPending,
    ids: (value) => picked.filter((p) => value.includes(`@${p.name}`)).map((p) => p.id),
    /** Spread on the text box (it replaces its `onChange`). */
    inputProps: (listId) => ({
      onChange: (e) => {
        setText(e.target.value)
        track(e)
      },
      onSelect: track,
      onClick: track,
      'aria-controls': open ? listId : undefined,
      'aria-activedescendant': open && options.length ? `${listId}-${Math.min(active, options.length - 1)}` : undefined,
    }),
  }
}

