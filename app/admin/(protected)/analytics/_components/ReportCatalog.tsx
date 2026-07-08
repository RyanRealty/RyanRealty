/**
 * ReportCatalog — the merged report launchpad inside the Performance hub
 * (was the standalone /admin/reports page until the admin consolidation
 * 2026-07-07): the grouped catalog of every report surface, the weekly
 * market report generator, and the interactive city/period builder.
 * Server component; the hub page passes the report cities in.
 */
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { generateWeeklyMarketReport } from '@/app/actions/generate-market-report'
import GenerateReportButton from './GenerateReportButton'
import CityReportSection from './CityReportSection'

type ReportTile = { href: string; title: string; desc: string; icon: string }
type ReportGroup = { label: string; tiles: ReportTile[] }

// Grouped tiles linking every report surface. Add new reports here; the UI
// derives entirely from this data.
const REPORT_GROUPS: ReportGroup[] = [
  {
    label: 'Start here',
    tiles: [
      {
        href: '/admin/analytics/action-required',
        icon: '⚡',
        title: 'Action required',
        desc: 'Hot leads to call now, warm prospects active, anonymous high-engagement for retargeting.',
      },
      {
        href: '/admin/analytics/ad-roi',
        icon: '💰',
        title: 'Marketing ROI',
        desc: 'Is the ad money working. Spend, leads, and cost per lead across channels.',
      },
      {
        href: '/admin/visitors/live',
        icon: '🟢',
        title: 'Live visitors',
        desc: 'Who is on the site right now and what they are looking at.',
      },
    ],
  },
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
      {
        href: '/admin/analytics/funnel-breakdown',
        icon: '🔻',
        title: 'Funnel breakdown',
        desc: 'Step-by-step drop-off with insights per landing page variant.',
      },
      {
        href: '/admin/analytics/lp-leaderboard',
        icon: '🏁',
        title: 'LP leaderboard',
        desc: 'Landing pages ranked by sessions, leads, and conversion rate.',
      },
      {
        href: '/admin/analytics/cost-per-lead',
        icon: '💸',
        title: 'Cost per lead',
        desc: 'Spend divided by leads, per channel and per campaign.',
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
      {
        href: '/admin/analytics/social',
        icon: '📱',
        title: 'Social channels',
        desc: 'Sessions and engagement from each social platform.',
      },
      {
        href: '/admin/analytics/demographics',
        icon: '👥',
        title: 'Demographics',
        desc: 'Visitor age bands and geography.',
      },
      {
        href: '/admin/analytics/listing-performance',
        icon: '🏠',
        title: 'Listing performance',
        desc: 'Which listings pull views, saves, and inquiries.',
      },
      {
        href: '/admin/analytics/google-search',
        icon: '🔍',
        title: 'Google Search (SEO)',
        desc: 'Queries, clicks, and rankings from Search Console.',
      },
      {
        href: '/admin/analytics/google-business-profile',
        icon: '📍',
        title: 'Google Business Profile',
        desc: 'Profile views, calls, and direction requests.',
      },
    ],
  },
]

export default function ReportCatalog({ cities }: { cities: string[] }) {
  return (
    <>
      {/* ── Report catalog (merged from /admin/reports, 2026-07-07) ── */}
      <ConsoleSection title="All reports">
        <div className="space-y-8">
          {REPORT_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.tiles.map((t) => (
                  <Link key={t.href} href={t.href} className="group block">
                    <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-accent/40">
                      <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xl leading-none" aria-hidden>{t.icon}</span>
                          <span className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
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

      {/* ── Weekly market report tool (merged from /admin/reports) ── */}
      <ConsoleSection title="Weekly market report">
        <p className="mb-4 text-sm text-muted-foreground">
          Generate the weekly report (last Sunday–Saturday). Lists homes that went pending and
          closed, by city, with an AI image and a shareable link. Cron can call{' '}
          <code className="rounded bg-muted px-1 text-xs">GET /api/cron/market-report</code> with{' '}
          <code className="rounded bg-muted px-1 text-xs">Authorization: Bearer CRON_SECRET</code>.
        </p>
        <GenerateReportButton generateAction={generateWeeklyMarketReport} />
      </ConsoleSection>

      {/* ── Interactive city/period builder (merged from /admin/reports) ── */}
      <CityReportSection cities={cities} />
    </>
  )
}
