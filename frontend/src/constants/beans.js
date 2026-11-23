import { formatKg } from '@/lib/format'
import { VARIETIES } from './charts'

// Bean listings (BeansFarmer.dc.html, BeansKaluppa.dc.html). Keys mirror backend/src/constants/beans.js.
export const BEAN_FORMS = [
  { key: 'fresh_cherry', label: 'Fresh cherry' },
  { key: 'dried_cherry', label: 'Dried cherry' },
  { key: 'parchment', label: 'Parchment' },
  { key: 'green_beans', label: 'Green beans' },
]
export const varietyLabel = (key) => VARIETIES.find((v) => v.key === key)?.label ?? key
export const formLabel = (key) => BEAN_FORMS.find((f) => f.key === key)?.label ?? key
/** “2 kg Liberica, dried cherry” — the view drawer title. */
export const beanTitle = (l) => `${formatKg(l.weightKg)} ${varietyLabel(l.variety)}, ${formLabel(l.form).toLowerCase()}`

export const BEAN_STATUS = {
  pending: { label: 'Waiting for review', tone: 'amber' },
  approved: { label: 'Approved · bring to Kaluppa', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
  expired: { label: 'Expired', tone: 'gray' },
  rejected: { label: 'Rejected', tone: 'red' },
}

// The screens' tabs become the Status filter (DESIGN §8.2: no tabs). Values are the API's status groups.
export const SELLER_STATUS_FILTER = {
  label: 'Status',
  options: [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Waiting' },
    { value: 'approved', label: 'Approved' },
    { value: 'completed', label: 'Completed' },
    { value: 'closed', label: 'Closed' },
  ],
}
// Kaluppa's screen has no “All” tab: “To review” is the default, so it never counts as a filter.
export const KALUPPA_STATUS_FILTER = {
  label: 'Status',
  options: [
    { value: 'pending', label: 'To review' },
    { value: 'approved', label: 'Waiting for drop-off' },
    { value: 'completed', label: 'Completed' },
    { value: 'closed', label: 'Closed' },
  ],
}
export const FORM_FILTER = { key: 'form', label: 'Form', options: [{ value: '', label: 'All forms' }, ...BEAN_FORMS.map((f) => ({ value: f.key, label: f.label }))] }
