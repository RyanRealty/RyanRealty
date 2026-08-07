'use client'

/**
 * VariantControl — the v2 LP-variant filter for the Performance hub funnel tab.
 * Same contract as _components/FunnelVariantFilter: `all` clears the
 * `lpVariant` param, anything else sets it, and the router pushes on change.
 * One compact control, never a pill row (ADMIN_UI surface bar, rule 2).
 */
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

export function VariantControl({ variants, current }: { variants: string[]; current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const onChange = (v: string) => {
    const next = new URLSearchParams(params.toString())
    if (v === 'all') next.delete('lpVariant')
    else next.set('lpVariant', v)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div style={{ marginBottom: 'var(--a-s4)' }}>
      <SelectField label="Filter by LP variant" value={current || 'all'} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All variants (combined)</option>
        {variants.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </SelectField>
    </div>
  )
}
