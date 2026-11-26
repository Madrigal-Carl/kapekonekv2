/**
 * Dashboard page header (DESIGN §8.1): eyebrow, 30px title, description, actions on the right.
 * @param {{ eyebrow?: string, title: string, description?: React.ReactNode, actions?: React.ReactNode }} props
 */
export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-[720px]">
        {eyebrow && <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">{eyebrow}</span>}
        <h1 className="mt-2 text-[30px] font-medium leading-[1.15] tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1.5 text-sm leading-[1.6] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5 max-[720px]:w-full max-[720px]:[&>*]:flex-auto">{actions}</div>}
    </div>
  )
}
