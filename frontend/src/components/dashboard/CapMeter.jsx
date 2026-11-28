/**
 * The 5 kg bean selling limit for farmers who aren't approved yet (a hint; the server enforces it).
 * @param {{ usedKg: number, limitKg: number }} props
 */
export function CapMeter({ usedKg, limitKg }) {
  const used = Math.min(usedKg, limitKg)
  const kg = (n) => `${n.toLocaleString('en-PH', { maximumFractionDigits: 1 })} kg`
  return (
    <section aria-labelledby="cap-h" className="flex flex-wrap items-center gap-4 rounded-card border border-sand bg-white px-[18px] py-4">
      <div className="flex-[1_1_280px]">
        <h2 id="cap-h" className="text-[14.5px] font-semibold">Bean selling limit</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-3">Until your Group Manager approves you, you can sell up to {kg(limitKg)} of beans to Kaluppa.</p>
      </div>
      <div className="flex-[1_1_320px]">
        <div className="flex justify-between text-[12.5px]">
          <span><strong>{kg(used)}</strong> of {kg(limitKg)} used</span>
          <span className="text-ink-3">{kg(limitKg - used)} left</span>
        </div>
        <div role="progressbar" aria-label="Bean selling limit used" aria-valuemin={0} aria-valuemax={limitKg} aria-valuenow={used} className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-skeleton">
          <span className="block h-full rounded-full bg-roast" style={{ width: `${(used / limitKg) * 100}%` }} />
        </div>
      </div>
    </section>
  )
}
