'use client'

import { useRouter } from 'next/navigation'
import { ToolbarSelect } from '@/components/admin/v2'

/**
 * Superuser-only broker filter for the newsletter analytics console (spec
 * §9.5). Navigates via ?broker=<slug> on change — a restricted broker never
 * sees this control (the page only renders it when scopeBroker() returned
 * null), so there is no client input path that can widen a restricted
 * broker's scope (G-NL-12).
 *
 * 11F: off shadcn and onto the locked v2 toolbar control. The navigation, the
 * option set and the option labels are unchanged; the control gains the
 * accessible name the Radix trigger never carried.
 */
export function BrokerFilterSelect({
  brokers,
  value,
}: {
  brokers: Array<{ slug: string; name: string }>
  value: string
}) {
  const router = useRouter()
  return (
    <ToolbarSelect
      aria-label="Filter by broker"
      value={value}
      onChange={(e) => router.push(`/admin/newsletters/analytics?broker=${e.target.value}`)}
    >
      <option value="all">All brokers</option>
      {brokers.map((b) => (
        <option key={b.slug} value={b.slug}>
          {b.name}
        </option>
      ))}
    </ToolbarSelect>
  )
}
