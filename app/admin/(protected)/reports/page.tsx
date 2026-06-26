import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { getReportCities } from '@/app/actions/reports'
import { generateWeeklyMarketReport } from '@/app/actions/generate-market-report'
import GenerateReportButton from './GenerateReportButton'
import CityReportSection from './CityReportSection'
import { ConsoleSection } from '@/components/console/ConsoleSection'

// ---------------------------------------------------------------------------
// Report catalog — grouped to mirror the FUB Reporting layout.
// Each group maps to a section header + card grid inside the ConsoleSection.
// Add new reports here; the UI derives entirely from this data.
// ---------------------------------------------------------------------------

type ReportTile = {
  href: string
  title: string
  desc: string
  icon: string
}

type ReportGroup = {
  label: string
  tiles: ReportTile[]
}

const REPORT_GROUPS: ReportGroup[] = [
  {
    label: 'Market data',
    tiles: [
      {
        href: '/admin/reports/market',
        icon: '📊',
        title: 'Market report by area',
        desc: 'Snapshot for a city, neighborhood, or community — median price, DOM, inventory, months of supply.',
      },
      {
        href: '/admin/reports/custom',
        icon: '🔧',
        title: 'Custom report builder',
        desc: 'Any location, any date range — metrics, price bands, time series, pending and closed.',
      },
    ],
  },
  {
    label: 'Broker activity',
    tiles: [
      {
        href: '/admin/reports/brokers',
        icon: '👤',
        title: 'Broker performance',
        desc: 'Volume, units, and pipeline by broker.',
      },
      {
        href: '/admin/analytics/action-required',
        icon: '⚡',
        title: 'Action required',
        desc: 'Hot leads to call now, warm prospects active, anonymous high-engagement for retargeting.',
      },
      {
        href: '/admin/people',
        icon: '📋',
        title: 'People index',
        desc: 'Every known contact seen on the site or assigned in the last 90 days.',
      },
    ],
  },
  {
    label: 'Lead sources',
    tiles: [
      {
        href: '/admin/reports/leads',
        icon: '🎯',
        title: 'Lead analytics',
        desc: 'Funnel, scoring distribution, and high-intent actions.',
      },
      {
        href: '/admin/reports/lead-flow',
        icon: '🔀',
        title: 'Lead-flow report',
        desc: 'GA4 sessions to form submits to broker assignments to CMAs, with wiring health per LP.',
      },
      {
        href: '/admin/reports/traffic-sources',
        icon: '🌐',
        title: 'Traffic sources',
        desc: 'Where every visitor came from — GBP attribution gap and channels to tag.',
      },
    ],
  },
  {
    label: 'Marketing',
    tiles: [
      {
        href: '/admin/reports/emails',
        icon: '✉️',
        title: 'Email reporting',
        desc: 'Sent-email log and open, click, and bounce rates from the unified email-events store.',
      },
      {
        href: '/admin/analytics/meta-health',
        icon: '📣',
        title: 'Meta health',
        desc: 'Pixel firing, lead-form inventory, webhook status, recent leads, and action items.',
      },
    ],
  },
]

// ---------------------------------------------------------------------------

export default async function AdminReportsPage() {
  const { cities } = await getReportCities()

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Market data, lead analytics, and traffic — one launchpad.
        </p>
      </div>

      {/* Weekly market report tool — kept above the catalog */}
      <ConsoleSection title="Weekly market report">
        <p className="mb-4 text-sm text-muted-foreground">
          Generate the weekly report (last Sunday–Saturday). Lists homes that went pending and
          closed, by city, with an AI image and a shareable link. Cron can call{' '}
          <code className="rounded bg-muted px-1 text-xs">GET /api/cron/market-report</code> with{' '}
          <code className="rounded bg-muted px-1 text-xs">Authorization: Bearer CRON_SECRET</code>.
        </p>
        <GenerateReportButton generateAction={generateWeeklyMarketReport} />
      </ConsoleSection>

      {/* Report catalog — FUB-style grouped cards */}
      <ConsoleSection title="All reports">
        <div className="space-y-8">
          {REPORT_GROUPS.map((group) => (
            <div key={group.label}>
              {/* Group label */}
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>

              {/* Card grid — responsive 1 → 2 → 3 cols */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.tiles.map((t) => (
                  <Link key={t.href} href={t.href} className="group block">
                    <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-accent/40">
                      <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xl leading-none" aria-hidden>
                            {t.icon}
                          </span>
                          <span
                            className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                          >
                            →
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{t.title}</div>
                          <div className="mt-0.5 text-sm text-muted-foreground">{t.desc}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ConsoleSection>

      {/* Interactive city/period builder — kept below catalog */}
      <CityReportSection cities={cities} />

      <p className="text-sm text-muted-foreground">
        <Link href="/admin/sync" className="underline hover:no-underline">
          Back to Sync
        </Link>
      </p>
    </main>
  )
}
