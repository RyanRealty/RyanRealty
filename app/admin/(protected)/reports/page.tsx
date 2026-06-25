import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { getReportCities } from '@/app/actions/reports'
import { generateWeeklyMarketReport } from '@/app/actions/generate-market-report'
import GenerateReportButton from './GenerateReportButton'
import CityReportSection from './CityReportSection'
import { ConsoleSection } from '@/components/console/ConsoleSection'

const REPORT_TILES = [
  { href: '/admin/reports/custom', title: 'Custom report builder', desc: 'Any location, any date range — metrics, price bands, time series, pending and closed.' },
  { href: '/admin/reports/market', title: 'Market report by area', desc: 'Pull a market snapshot for a city, neighborhood, or community.' },
  { href: '/admin/reports/brokers', title: 'Broker performance', desc: 'Volume, units, and pipeline by broker.' },
  { href: '/admin/reports/leads', title: 'Lead analytics', desc: 'Funnel, scoring distribution, and high-intent actions.' },
  { href: '/admin/reports/lead-flow', title: 'Lead-flow report', desc: 'GA4 sessions to form submits to broker assignments to CMAs, with wiring health per LP.' },
  { href: '/admin/reports/traffic-sources', title: 'Traffic sources', desc: 'Where every visitor came from. The GBP attribution gap and channels to tag.' },
  { href: '/admin/reports/emails', title: 'Email reporting', desc: 'Sent-email log and open, click, and bounce rates from the unified email-events store.' },
  { href: '/admin/analytics/action-required', title: 'Action required', desc: 'Hot leads to call now, warm prospects active, anonymous high-engagement for retargeting.' },
  { href: '/admin/people', title: 'People index', desc: 'Every known FUB person seen on the site or assigned in the last 90 days.' },
  { href: '/admin/analytics/meta-health', title: 'Meta health', desc: 'Pixel firing, lead-form inventory, webhook status, recent leads, action items.' },
]

export default async function AdminReportsPage() {
  const { cities } = await getReportCities()
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Market data, lead analytics, and traffic — one launchpad.</p>
      </div>

      <ConsoleSection title="Weekly market report">
        <p className="mb-4 text-sm text-muted-foreground">
          Generate the weekly report (last Sunday–Saturday). Lists homes that went pending and closed, by city, with an AI image and a shareable link. Cron can call <code className="rounded bg-muted px-1 text-xs">GET /api/cron/market-report</code> with <code className="rounded bg-muted px-1 text-xs">Authorization: Bearer CRON_SECRET</code>.
        </p>
        <GenerateReportButton generateAction={generateWeeklyMarketReport} />
      </ConsoleSection>

      <CityReportSection cities={cities} />

      <ConsoleSection title="All reports">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REPORT_TILES.map((t) => (
            <Link key={t.href} href={t.href} className="group block">
              <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-accent/40">
                <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{t.title}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">{t.desc}</div>
                  </div>
                  <span className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </ConsoleSection>

      <p className="text-sm text-muted-foreground">
        <Link href="/admin/sync" className="underline hover:no-underline">Back to Sync</Link>
      </p>
    </main>
  )
}
