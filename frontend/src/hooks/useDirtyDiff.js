import { useMemo, useState } from 'react'

const isEmpty = (v) => v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0)
const isNumeric = (v) => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v)) && typeof v !== 'boolean' && !Array.isArray(v)

/** '' / null / undefined / [] are the same "nothing"; "1.5" equals 1.5 (number inputs); the rest compares by value. */
export function sameValue(a, b) {
  if (isEmpty(a) && isEmpty(b)) return true
  if ((typeof a === 'number' || typeof b === 'number') && isNumeric(a) && isNumeric(b)) return Number(a) === Number(b)
  return JSON.stringify(a) === JSON.stringify(b)
}

const show = (v) => {
  if (isEmpty(v)) return '—'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'boolean') return v ? 'On' : 'Off'
  return String(v)
}

/**
 * The fields that changed, in the order of `labels`, as the form names them (FarmEditConfirm.dc.html).
 * @param {object} initial the values the form opened with
 * @param {object} current the live values
 * @param {Record<string, string | { label: string, format?: (value: any) => string, sensitive?: boolean }>} labels only these fields count
 * @returns {Array<{ key: string, label: string, from: string, to: string, sensitive?: boolean }>}
 */
export function diffValues(initial, current, labels) {
  return Object.entries(labels).flatMap(([key, spec]) => {
    const { label, format = show, sensitive = false } = typeof spec === 'string' ? { label: spec } : spec
    const from = initial?.[key]
    const to = current?.[key]
    if (sameValue(from, to)) return []
    // Passwords and the like never show as text.
    if (sensitive) return [{ key, label, from: '', to: 'changed', sensitive: true }]
    return [{ key, label, from: isEmpty(from) ? '—' : format(from), to: isEmpty(to) ? '—' : format(to) }]
  })
}

/** `diffValues`, memoised for a form: `useDirtyDiff(initial, useWatch({ control }), LABELS)`. */
export function useDirtyDiff(initial, current, labels) {
  const key = JSON.stringify(current ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is `current` by value (useWatch returns a new object each render)
  return useMemo(() => diffValues(initial, current, labels), [initial, key, labels])
}

/**
 * Edits go through "Save these changes?"; creating something new saves at once.
 * `submit(body)` either sends or opens the modal; spread `modal` onto ConfirmChangesModal.
 * @param {boolean} editing
 * @param {(body: any) => void} send
 */
export function useSaveConfirm(editing, send) {
  const [body, setBody] = useState(null)
  return {
    submit: (next) => (editing ? setBody({ next }) : send(next)),
    modal: {
      open: body !== null,
      onClose: () => setBody(null),
      onConfirm: () => {
        send(body.next)
        setBody(null)
      },
    },
  }
}
