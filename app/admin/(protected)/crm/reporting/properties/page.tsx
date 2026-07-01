// @no-parity — internal admin surface
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown, MapPin } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { getPropertiesReport } from '@/lib/data/crm/getPropertiesReport'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import PropertiesFilters from './PropertiesFilters'
import { PropertiesMap } from './PropertiesMap'

export const metadata = { title: 'Properties | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Sub-nav tabs ──────────────────────────────────────────────────────────────
const REPORTING_TABS = [
  { label: 'Overview', href: '/admin/crm/reporting' },
  { label: 'Agent Activity', href: '/admin/crm/reporting/agent-activity' },
  { label: 'Properties', href: '/admin/crm/reporting/properties', active: true },
  { label: 'Lead Sources', href: '/admin/crm/reporting/lead-sources' },
  { label: 'Calls', href: '/admin/crm/reporting/calls' },
  { label: 'Texts', href: '/admin/crm/reporting/texts' },
  { label: 'Batch Emails', href: '/admin/crm/reporting/batch-emails' },
  { label: 'Marketing', href: '/admin/crm/reporting/marketing' },
  { label: 'Deals', href: '/admin/crm/reporting/deals' },
  { label: 'Appointments', href: '/admin/crm/reporting/appointments' },
  { label: 'Agent Goals', href: '/admin/crm/reporting/agent-goals' },
]

// ── Search params ─────────────────────────────────────────────────────────────
type SearchParams = {
  date?: string
  t?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function datePresetLabel(preset: string): string {
  switch (preset) {
    case 'today':
      return 'Today'
    case 'this_week':
      return 'This Week'
    case 'this_year':
      return 'This Year'
    default:
      return 'This Month'
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const datePreset = (sp.date ?? 'this_month') as
    | 'today'
    | 'this_week'
    | 'this_month'
    | 'this_year'

  // Fetch report data — no broker scope (Properties has no agent filter)
  const report = await getPropertiesReport({ datePreset }).catch(() => null)

  const rows = report?.rows ?? []
  const totalViews = report?.totalViews ?? 0
  const uniqueProperties = report?.uniqueProperties ?? 0
  const currentDate = datePreset

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Sub-nav tab strip */}
      <div className="mb-6 flex items-center border-b border-border">
        <div className="no-scrollbar flex items-center gap-0 overflow-x-auto">
          {REPORTING_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                tab.active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto shrink-0 pb-0.5 pl-4">
          <Badge variant="outline" className="text-muted-foreground">
            ⓘ How Reporting works
          </Badge>
        </div>
      </div>

      {/* Header row: "Show me" selector + date filter */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Show me</span>
          <div className="flex items-center gap-0.5">
            <span className="font-medium text-foreground">
              which property has the most inquiries
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <PropertiesFilters currentDate={currentDate} />
      </div>

      {/* Cache notice */}
      <p className="mb-4 text-xs text-muted-foreground">
        Reporting results may be cached for up to 10 minutes.{' '}
        <Link
          href={`/admin/crm/reporting/properties?date=${currentDate}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* Summary strip — totalViews + uniqueProperties */}
      {totalViews > 0 && (
        <div className="mb-4 flex items-center gap-6">
          <div className="text-sm text-muted-foreground">
            <span className="tabular-nums font-semibold text-foreground">
              {totalViews.toLocaleString('en-US')}
            </span>{' '}
            {totalViews === 1 ? 'inquiry' : 'inquiries'}
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="tabular-nums font-semibold text-foreground">
              {uniqueProperties.toLocaleString('en-US')}
            </span>{' '}
            {uniqueProperties === 1 ? 'property' : 'properties'}
          </div>
          <div className="text-xs text-muted-foreground">{datePresetLabel(currentDate)}</div>
        </div>
      )}

      {/* Main content: left ranked list + right map */}
      {rows.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex h-[560px] items-center justify-center rounded-xl border border-border bg-muted/20">
          <div className="flex flex-col items-center gap-3 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              No property inquiries for{' '}
              {datePresetLabel(currentDate).toLowerCase()}.
            </p>
            <p className="max-w-xs text-xs text-muted-foreground/70">
              Inquiries are logged when site visitors view a listing detail page.
              Try a wider date range or check back after more site traffic.
            </p>
          </div>
        </div>
      ) : (
        /* ── Two-column: ranked list + map ── */
        <div className="flex h-[560px] overflow-hidden rounded-xl border border-border">
          {/* Left panel — scrollable ranked list */}
          <div className="w-72 shrink-0 overflow-y-auto border-r border-border bg-card">
            {rows.map((row, index) => (
              <div
                key={row.listingMls}
                className="flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/40"
              >
                {/* Rank number */}
                <span className="mt-0.5 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                  {index + 1}
                </span>

                {/* Address block */}
                <div className="min-w-0 flex-1">
                  {row.listingUrl ? (
                    <Link
                      href={row.listingUrl}
                      className="block truncate text-sm font-medium text-primary hover:underline"
                      title={row.fullAddress}
                    >
                      {row.streetNumber
                        ? `${row.streetNumber} ${row.streetName}`.trim()
                        : row.streetName || `Listing #${row.listingMls}`}
                    </Link>
                  ) : (
                    <span
                      className="block truncate text-sm font-medium text-foreground"
                      title={row.fullAddress}
                    >
                      {row.streetNumber
                        ? `${row.streetNumber} ${row.streetName}`.trim()
                        : row.streetName || `Listing #${row.listingMls}`}
                    </span>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {[row.city, row.postalCode ? `OR ${row.postalCode}` : 'OR']
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>

                {/* Inquiry count badge */}
                <Badge
                  variant="secondary"
                  className="ml-auto mt-0.5 shrink-0 tabular-nums text-xs font-medium"
                >
                  {row.viewCount}&nbsp;{row.viewCount === 1 ? 'Inq' : 'Inq'}
                </Badge>
              </div>
            ))}
          </div>

          {/* Right panel — Google Map */}
          <div className="relative flex-1 bg-muted/20">
            <PropertiesMap rows={rows} />
          </div>
        </div>
      )}
    </div>
  )
}
