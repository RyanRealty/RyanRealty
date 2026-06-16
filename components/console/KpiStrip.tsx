/**
 * KpiStrip — the tight 4-cell metric strip from the approved Lead Command
 * Center mockup (design_system/ryan-realty/ui_kits/lead-command-center/
 * picked-mockup.html). Soft fill, no border, big number + quiet label. Shared so
 * every console surface that needs an at-a-glance row looks identical.
 */
export type KpiCell = { label: string; value: number | string }

export function KpiStrip({ items }: { items: KpiCell[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-lg bg-secondary px-3 py-2.5">
          <div className="text-xl font-semibold tabular-nums text-foreground">{k.value}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{k.label}</div>
        </div>
      ))}
    </div>
  )
}
