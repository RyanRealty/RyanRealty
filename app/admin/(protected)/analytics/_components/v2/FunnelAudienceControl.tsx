'use client'

/**
 * Audience toggle for the Performance funnel. One compact select, never a
 * chip row (ADMIN_UI surface bar, rule 2).
 */
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

const OPTIONS = [
  { value: 'seller', label: 'Seller' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'recruit', label: 'Broker recruitment' },
] as const

export function FunnelAudienceControl({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const onChange = (v: string) => {
    const next = new URLSearchParams(params.toString())
    if (v === 'seller') next.delete('audience')
    else next.set('audience', v)
    next.delete('stage')
    next.delete('door')
    if (!next.get('tab')) next.set('tab', 'funnel')
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="av2-inline-form" style={{ marginBottom: 'var(--a-s4)' }}>
      <SelectField label="Audience" value={current || 'seller'} onChange={(e) => onChange(e.target.value)}>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectField>
    </div>
  )
}
