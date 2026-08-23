/**
 * ReportCatalog — the merged report launchpad inside the Performance hub
 * (was the standalone /admin/reports page until the admin consolidation
 * 2026-07-07): the grouped catalog of every report surface, the weekly
 * market report generator, and the interactive city/period builder.
 * Server component; the hub page passes the report cities in.
 *
 * 11C: presentation migrated to the LOCKED admin v2 language with the hub —
 * the tile grid became quiet catalog rows (a launchpad is a list of doors, not
 * a board of cards). The group data, every href, the weekly-report server
 * action and the city builder are unchanged.
 */
import Link from 'next/link'
import { SectionHead } from '@/components/admin/v2'
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
      {
        href: '/admin/analytics/city-leaderboard',
        icon: '🏙️',
        title: 'City market ranks',
        desc: 'Detached YoY, price, speed, price-cuts, and new inventory by city from Market Truth.',
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
        href: '/admin/reports/cma-performance',
        icon: '📄',
        title: 'CMA send performance',
        desc: 'Per-document opens, clicks and report views for every CMA, audit and BPO, with the built to sent to opened funnel.',
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
      <section aria-label="All reports">
        <SectionHead>All reports</SectionHead>
        {REPORT_GROUPS.map((group) => (
          <div key={group.label}>
            <SectionHead>{group.label}</SectionHead>
            <ul className="av2-quietlist">
              {group.tiles.map((t) => (
                <li key={t.href} className="av2-quiet">
                  <Link href={t.href} className="av2-quiet__name" style={{ color: 'var(--a-accent)' }}>
                    {t.title}
                  </Link>
                  <span>{t.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* ── Weekly market report tool (merged from /admin/reports) ── */}
      <section aria-label="Weekly market report">
        <SectionHead>Weekly market report</SectionHead>
        <p className="av2-note">
          Generate the weekly report (last Sunday–Saturday). Lists homes that went pending and
          closed, by city, with an AI image and a shareable link. Cron can call{' '}
          <code>GET /api/cron/market-report</code> with{' '}
          <code>Authorization: Bearer CRON_SECRET</code>.
        </p>
        <GenerateReportButton generateAction={generateWeeklyMarketReport} />
      </section>

      {/* ── Interactive city/period builder (merged from /admin/reports) ── */}
      <CityReportSection cities={cities} />
    </>
  )
}
