import { ArrowDownUp, Check, ChevronDown, House, MapPin, Search, Tag, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

const ICONS = { pin: MapPin, home: House, sort: ArrowDownUp, tag: Tag }
const POPOVER_MAX = 340 // search + 236px list + footer, used to decide whether to flip up

const normalize = (options) => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))

/** Label split around the first match of `q`, for the highlight. */
function Highlight({ label, q }) {
  const at = q ? label.toLowerCase().indexOf(q) : -1
  if (at < 0) return label
  return (
    <>
      {label.slice(0, at)}
      <mark className="rounded-[2px] bg-caramel-tint px-px font-semibold text-ink">{label.slice(at, at + q.length)}</mark>
      {label.slice(at + q.length)}
    </>
  )
}

/**
 * The app's only select (SearchSelect.dc.html): icon tile, value, round chevron; a popover with search,
 * highlighted matches, a check on the chosen option and keyboard hints. Rendered in a portal so modals don't clip it.
 * Works with react-hook-form through `Controller` (`ref` goes to the trigger, so RHF can focus it on error).
 * @param {{
 *   label?: string, options: Array<string | { value: string, label: string }>, value: string | null | undefined,
 *   onChange: (value: string) => void, placeholder?: string, searchPlaceholder?: string,
 *   icon?: 'pin'|'home'|'sort'|'tag'|'none', size?: 'md'|'sm', searchable?: boolean, disabled?: boolean,
 *   error?: string, 'aria-label'?: string, name?: string, id?: string, className?: string, ref?: React.Ref<HTMLButtonElement>,
 * }} props
 */
export function SearchSelect({
  label, options, value, onChange, placeholder = 'Select an option', searchPlaceholder = 'Search…', icon = 'none', size = 'md',
  searchable = true, disabled = false, error, 'aria-label': ariaLabel, name, id, className, ref, onBlur,
}) {
  const uid = useId()
  const items = normalize(options)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState(null)
  const trigger = useRef(null)
  const popover = useRef(null)
  const searchRef = useRef(null)

  const q = query.trim().toLowerCase()
  const matches = items.filter((o) => !q || o.label.toLowerCase().includes(q))
  const act = Math.min(active, Math.max(0, matches.length - 1))
  const selected = items.find((o) => o.value === value)
  const Icon = ICONS[icon]
  const ids = { trigger: id ?? `${uid}-trigger`, label: `${uid}-label`, list: `${uid}-list`, error: `${uid}-error`, option: (i) => `${uid}-o${i}` }

  const setTriggerRef = (el) => {
    trigger.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  const show = (initialQuery = '') => {
    if (disabled) return
    setQuery(initialQuery)
    setActive(initialQuery ? 0 : Math.max(0, items.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    setQuery('')
    if (refocus) trigger.current?.focus()
    onBlur?.()
  }
  const choose = (option) => {
    onChange(option.value)
    close()
  }

  // Position the portal under the trigger (or above it when there's no room below), and keep it there.
  useLayoutEffect(() => {
    if (!open) return undefined
    const measure = () => {
      const r = trigger.current.getBoundingClientRect()
      const below = window.innerHeight - r.bottom
      const up = below < POPOVER_MAX && r.top > below
      setPlace({ left: r.left, width: Math.max(r.width, 220), top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open])

  useEffect(() => {
    if (!open || !place) return
    ;(searchable ? searchRef.current : popover.current?.querySelector('[role="listbox"]'))?.focus()
  }, [open, place, searchable])

  useEffect(() => {
    if (open) document.getElementById(`${uid}-o${act}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, act, uid])

  // Outside click closes without moving focus (the user is clicking somewhere else).
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (!trigger.current?.contains(event.target) && !popover.current?.contains(event.target)) close(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  })

  const onListKey = (event) => {
    const keys = {
      ArrowDown: () => setActive(Math.min(act + 1, matches.length - 1)),
      ArrowUp: () => setActive(Math.max(act - 1, 0)),
      Home: () => setActive(0),
      End: () => setActive(Math.max(0, matches.length - 1)),
      Enter: () => matches[act] && choose(matches[act]),
      Escape: () => close(),
      Tab: () => close(),
    }
    if (!keys[event.key]) return
    // Esc must not also close a surrounding modal; Tab returns to the trigger so focus stays in the dialog.
    event.preventDefault()
    event.stopPropagation()
    keys[event.key]()
  }

  const onTriggerKey = (event) => {
    if (open) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      show()
    } else if (searchable && event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      show(event.key) // type to filter
    }
  }

  const sm = size === 'sm'
  return (
    <div className={cn('relative w-full', className)}>
      {label && (
        <span id={ids.label} className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">
          {label}
        </span>
      )}
      <button
        ref={setTriggerRef}
        id={ids.trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? ids.list : undefined}
        aria-labelledby={label ? `${ids.label} ${ids.trigger}` : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ids.error : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={onTriggerKey}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2.5 rounded-control border bg-white pr-2.5 text-left text-ink outline-none focus-visible:border-roast focus-visible:ring-3 focus-visible:ring-roast/18',
          label && 'mt-1.5',
          sm ? 'min-h-10 text-[13.5px]' : 'min-h-11 text-sm',
          Icon ? 'pl-2' : 'pl-3',
          error ? 'border-danger-strong' : open ? 'border-roast ring-3 ring-roast/18' : 'border-sand-strong',
          disabled && 'cursor-not-allowed bg-cream text-ink-4',
        )}
      >
        {Icon && (
          <span aria-hidden="true" className="grid size-[26px] shrink-0 place-items-center rounded-control bg-crema text-roast">
            <Icon className="size-[15px]" strokeWidth={2} />
          </span>
        )}
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-ink-4')}>
          {selected?.label ?? placeholder}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-200 motion-reduce:transition-none',
            open ? 'rotate-180 bg-roast text-white' : 'bg-foam text-roast',
          )}
        >
          <ChevronDown className="size-3.5" strokeWidth={2.4} />
        </span>
      </button>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      {error && (
        <p id={ids.error} role="alert" className="mb-0 mt-1.5 text-xs text-danger-ink">
          {error}
        </p>
      )}

      {open &&
        place &&
        createPortal(
          <div
            ref={popover}
            style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom }}
            className="fixed z-[60] overflow-hidden rounded-card border border-sand bg-white text-ink shadow-dropdown"
          >
            {searchable && (
              <div className="relative border-b border-sand-soft p-2.5">
                <Search aria-hidden="true" className="absolute left-[22px] top-1/2 size-[15px] -translate-y-1/2 text-ink-4" strokeWidth={2} />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={ids.list}
                  aria-autocomplete="list"
                  aria-activedescendant={matches.length ? ids.option(act) : undefined}
                  aria-label={`Search ${(label || ariaLabel || 'options').toLowerCase()}`}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onListKey}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-control border border-sand-strong bg-white py-2 pl-[34px] pr-[30px] text-[13.5px] text-ink outline-none placeholder:text-ink-4 focus:border-roast focus:ring-3 focus:ring-roast/18"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery('')
                      setActive(0)
                      searchRef.current?.focus()
                    }}
                    className="absolute right-3.5 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded border-0 bg-transparent text-ink-4"
                  >
                    <X aria-hidden="true" className="size-3.5" strokeWidth={2} />
                  </button>
                )}
              </div>
            )}
            <ul
              id={ids.list}
              role="listbox"
              aria-label={label || ariaLabel || 'Options'}
              tabIndex={searchable ? undefined : -1}
              aria-activedescendant={!searchable && matches.length ? ids.option(act) : undefined}
              onKeyDown={searchable ? undefined : onListKey}
              className="m-0 max-h-[236px] list-none overflow-y-auto p-1.5 outline-none"
            >
              {matches.map((o, i) => (
                <li
                  key={o.value}
                  id={ids.option(i)}
                  role="option"
                  aria-selected={o.value === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                  onMouseEnter={() => i !== act && setActive(i)}
                  className={cn('flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-[9px] text-[13.5px]', i === act && 'bg-crema')}
                >
                  <span className="min-w-0 flex-1">
                    <Highlight label={o.label} q={q} />
                  </span>
                  {o.value === value && <Check aria-hidden="true" className="size-4 shrink-0 text-roast" strokeWidth={2.5} />}
                </li>
              ))}
              {matches.length === 0 && (
                <li role="presentation" className="px-2.5 py-[18px] text-center text-[13px] text-ink-3">
                  No match for “{query}”
                </li>
              )}
            </ul>
            <div className="flex justify-between gap-2 border-t border-sand-soft bg-cream px-3 py-[7px] text-[11.5px] text-ink-3">
              <span aria-live="polite">{q ? `${matches.length} of ${items.length}` : `${items.length} options`}</span>
              <span className="max-[400px]:hidden">↑ ↓ to move · Enter to pick · Esc to close</span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
