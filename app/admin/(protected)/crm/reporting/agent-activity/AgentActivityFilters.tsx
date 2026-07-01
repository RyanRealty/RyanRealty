'use client'
import { useRouter, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Broker = { slug: string; label: string }

interface Props {
  currentBroker: string
  currentDate: string
  currentView: string
  brokers: Broker[]
}

export default function AgentActivityFilters({ currentBroker, currentDate, currentView, brokers }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      view: currentView,
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

      {/* Lead type (static for V1) */}
      <Select value="web" onValueChange={() => {}}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="Web leads" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All leads</SelectItem>
          <SelectItem value="web">Web leads</SelectItem>
          <SelectItem value="manual">Manual leads</SelectItem>
        </SelectContent>
      </Select>

      {/* Date range */}
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
