'use client'
import { useRouter, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Broker = { slug: string; label: string }

interface Props {
  currentBroker: string
  currentDate: string
  brokers: Broker[]
}

/**
 * Contact Attempts report filter bar — agent selector + date preset.
 * Mirrors the Calls and Texts filter pattern (no lead-type / cols filters needed).
 */
export default function ContactAttemptsFilters({
  currentBroker,
  currentDate,
  brokers,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      ...updates,
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {/* Agent selector */}
      <Select value={currentBroker} onValueChange={(v) => navigate({ broker: v })}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Everyone" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="everyone">Everyone</SelectItem>
          {brokers.map((b) => (
            <SelectItem key={b.slug} value={b.slug}>
              {b.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date preset */}
      <Select value={currentDate} onValueChange={(v) => navigate({ date: v })}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="This Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="this_year">This Year</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
