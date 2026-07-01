'use client'
import { useRouter, usePathname } from 'next/navigation'
import { Download } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type Broker = { slug: string; label: string }

interface Props {
  currentBroker: string
  currentDate: string
  currentCols?: string
  brokers: Broker[]
}

export default function LeadSourcesFilters({
  currentBroker,
  currentDate,
  currentCols,
  brokers,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      ...(currentCols ? { cols: currentCols } : {}),
      ...updates,
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  const exportParams = new URLSearchParams({
    broker: currentBroker,
    date: currentDate,
    ...(currentCols ? { cols: currentCols } : {}),
  })

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {/* Export / download button */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        aria-label="Download CSV"
        asChild
      >
        <a href={`/admin/crm/reporting/lead-sources/export?${exportParams.toString()}`} download>
          <Download className="h-3.5 w-3.5" />
        </a>
      </Button>

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
