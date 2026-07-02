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
  currentView: string
  currentCols?: string
  brokers: Broker[]
  /** Superusers may change the agent scope; everyone else is locked to "Me" */
  isSuperuser: boolean
  /** Display name for the locked "Me" state (non-superusers) */
  lockedBrokerLabel?: string
}

export default function AgentActivityFilters({
  currentBroker,
  currentDate,
  currentView,
  currentCols,
  brokers,
  isSuperuser,
  lockedBrokerLabel,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      view: currentView,
      ...(currentCols ? { cols: currentCols } : {}),
      ...updates,
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  // Build the CSV export URL from current filter state
  const exportParams = new URLSearchParams({
    broker: currentBroker,
    date: currentDate,
    ...(currentCols ? { cols: currentCols } : {}),
  })
  const exportHref = `/admin/crm/reporting/agent-activity/export?${exportParams.toString()}`

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {/* Export / download button (server route re-scopes to the caller's role) */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        aria-label="Download CSV"
        asChild
      >
        <a href={exportHref} download>
          <Download className="h-3.5 w-3.5" />
        </a>
      </Button>

      {/* Agent selector — locked to "Me" for non-superusers (data-layer scoped too) */}
      {isSuperuser ? (
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
      ) : (
        <Select value="me" disabled>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="me">{lockedBrokerLabel ?? 'Me'}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Lead type — the CRM has no web-vs-manual lead classification, so only
          "All leads" is real; the FUB-parity options render disabled (honest UI) */}
      <Select value="all" onValueChange={() => {}}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="All leads" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All leads</SelectItem>
          <SelectItem value="web" disabled>
            Web leads
          </SelectItem>
          <SelectItem value="manual" disabled>
            Manual leads
          </SelectItem>
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
