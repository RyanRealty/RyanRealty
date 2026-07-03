'use client'

import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * Superuser-only broker filter for the newsletter analytics console (spec
 * §9.5). Navigates via ?broker=<slug> on change — a restricted broker never
 * sees this control (the page only renders it when scopeBroker() returned
 * null), so there is no client input path that can widen a restricted
 * broker's scope (G-NL-12).
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
    <Select
      value={value}
      onValueChange={(next) => router.push(`/admin/newsletters/analytics?broker=${next}`)}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="All brokers" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All brokers</SelectItem>
        {brokers.map((b) => (
          <SelectItem key={b.slug} value={b.slug}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
