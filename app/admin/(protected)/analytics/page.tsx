/**
 * /admin/analytics — the Performance hub: ONE launchpad for every analytics
 * and reporting surface (admin consolidation 2026-07-07 — the old /admin/reports
 * launchpad merged in here and now redirects).
 *
 * Five GA4 tabs (Overview, Acquisition, Behavior, Funnel, Conversions), the
 * merged report catalog (market data, broker activity, lead sources,
 * marketing), and the weekly-report + city-report tools that used to live on
 * the Reports page. Server-side data fetching via Promise.all. Tabular
 * numerals on every numeric surface.
 *
 * Data trace:
 *   - Overview / Acquisition / Behavior  → GA4 Data API (getGA4Summary)
 *   - Funnel                              → GA4 + public.crm_people (getLeadIntake) + public.cmas
 *   - Conversions                         → GA4 + public.crm_people (getLeadIntake) + public.marketing_channel_daily
 *
 * Per-figure citation lives in ./citations.json.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only — the five tab keys, the tab-href param carry-over, the
 * active-tab-only render, every fetch* call and every formatter are carried over
 * verbatim. CityReportSection + GenerateReportButton stay sanctioned legacy
 * machinery, exclusively owned by this route, and migrate with a later unit.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { SectionHead, StateWord } from '@/components/admin/v2'
import { DataList, Figures, Loading } from './_components/v2/kit'
import { getReportCities } from '@/app/actions/reports'
import {
  resolveDateRange,
  fetchOverview,
  fetchAcquisition,
  fetchBehavior,
  fetchFunnel,
  fetchConversions,
} from './_lib/queries'
import { formatInt, formatPct, formatUsd, formatDuration } from './_lib/formatters'
import { RangeControl } from './_components/v2/RangeControl'
import { VariantControl } from './_components/v2/VariantControl'
import { HorizontalBarChart, TimeSeriesChart, BrokerPieChart, StackedBarMix } from './_components/charts'
import ReportCatalog from './_components/ReportCatalog'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Record<string, string | string[] | undefined>

function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) out[k] = v[0]
    else out[k] = v
  }
  return out
}

const TAB_DEFS = [
  { key: 'overview', label: 'Overview' },
  { key: 'acquisition', label: 'Acquisition' },
  { key: 'behavior', label: 'Behavior' },
  { key: 'funnel', label: 'Funnel' },
  { key: 'conversions', label: 'Conversions' },
] as const

type TabKey = (typeof TAB_DEFS)[number]['key']

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  const tab: TabKey = TAB_DEFS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : 'overview'
  const lpVariant = sp.lpVariant || ''
  const rangeChoice = sp.range || '30d'
  const { cities } = await getReportCities()

  // Tab links carry the current range/variant params so switching tabs keeps
  // the selected window. Tabs navigate (server render) instead of toggling
  // client-side because only the ACTIVE tab's server component renders now.
  const tabHref = (t: TabKey) => {
    const p = new URLSearchParams()
    if (t !== 'overview') p.set('tab', t)
    for (const k of ['range', 'startDate', 'endDate', 'lpVariant'] as const) {
      if (sp[k]) p.set(k, String(sp[k]))
    }
    const qs = p.toString()
    return qs ? `/admin/analytics?${qs}` : '/admin/analytics'
  }

  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <p className="av2-note">
        Every analytics and reporting surface in one place: traffic, funnel, conversions, and the report catalog. Overview/Acquisition/Behavior tabs are GA4 (consent-gated — not primary site volume). Primary traffic = first-party visitor_sessions (funnel-breakdown, social, traffic-sources). See docs/plans/seo-voice/MEASUREMENT_DUAL_SOURCE.md. Range: {range.startDate} to {range.endDate}.
      </p>
      <RangeControl current={rangeChoice} currentStart={sp.startDate} currentEnd={sp.endDate} />

      {/* Only the ACTIVE tab's server component renders. The old version
          mounted all five async RSCs on every request, so the four hidden tabs
          still executed their full GA4 + Supabase data paths (spend, daily
          series, CMA counts, funnel variants) on each navigation — pure waste
          on a force-dynamic page (audit 2026-07-14). Triggers are links that
          set ?tab= and re-render on the server. */}
      <nav className="av2-wordrow" aria-label="Performance views" style={{ marginBottom: 'var(--a-s4)' }}>
        {TAB_DEFS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className="av2-btn av2-btn--quiet"
            aria-current={t.key === tab ? 'page' : undefined}
            style={
              t.key === tab
                ? { textDecoration: 'none', background: 'var(--a-accent-wash)', borderColor: 'var(--a-accent)' }
                : { textDecoration: 'none' }
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Suspense fallback={<Loading what="the GA4 window" />}>
        {tab === 'overview' ? (
          <OverviewTab range={range} />
        ) : tab === 'acquisition' ? (
          <AcquisitionTab range={range} />
        ) : tab === 'behavior' ? (
          <BehaviorTab range={range} />
        ) : tab === 'funnel' ? (
          <FunnelTab range={range} lpVariant={lpVariant} />
        ) : (
          <ConversionsTab range={range} />
        )}
      </Suspense>

      {/* Merged report launchpad: catalog + weekly tool + city builder. */}
      <ReportCatalog cities={cities} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Overview
// ────────────────────────────────────────────────────────────────────────────

async function OverviewTab({ range }: { range: { startDate: string; endDate: string } }) {
  const d = await fetchOverview(range)

  return (
    <>
      <Figures
        figures={[
          { label: 'Sessions', value: formatInt(d.sessions) },
          { label: 'Total users', value: formatInt(d.totalUsers), caption: `${formatInt(d.newUsers)} new` },
          {
            label: 'Leads (CRM)',
            value: formatInt(d.crmLeadCount),
            caption: `${formatPct(d.leadConversionRate, 2)} of sessions · ${formatInt(d.generateLeadCount)} form submits (GA4)`,
          },
          {
            label: 'Paid spend',
            value: d.paidSpendUsd === null ? 'no data' : formatUsd(d.paidSpendUsd),
            caption: d.paidSpendUsd === null ? 'Meta cron has not synced spend yet' : 'Meta ads spend in the range',
          },
          { label: 'Engagement rate', value: formatPct(d.engagementRate) },
          { label: 'Bounce rate', value: formatPct(d.bounceRate) },
          { label: 'Avg. session duration', value: formatDuration(d.averageSessionDurationSeconds) },
          {
            label: 'Top source',
            value: d.topSources[0]?.sourceMedium ?? 'no data',
            caption: d.topSources[0] ? `${formatInt(d.topSources[0].sessions)} sessions` : null,
          },
        ]}
      />

      <section aria-label="Top 3 sources">
        <SectionHead>Top 3 sources</SectionHead>
        <DataList
          label="Top 3 sources"
          rows={d.topSources}
          cap={d.topSources.length}
          rowKey={(s) => s.sourceMedium}
          columns={[
            { key: 'source', header: 'Source / Medium', lead: true, cell: (s) => s.sourceMedium },
            { key: 'sessions', header: 'Sessions', num: true, cell: (s) => formatInt(s.sessions) },
          ]}
          empty={<>No source data in this range. Widen the date range above.</>}
        />
      </section>

      <section aria-label="Top 3 landing pages">
        <SectionHead>Top 3 landing pages</SectionHead>
        {/* GA4 can return the same pagePath twice (e.g. "/") — key by position too */}
        <DataList
          label="Top 3 landing pages"
          rows={d.topLandingPages}
          cap={d.topLandingPages.length}
          rowKey={(p, i) => `${i}|${p.pagePath}`}
          columns={[
            { key: 'page', header: 'Page', lead: true, cell: (p) => p.pagePath },
            { key: 'views', header: 'Views', num: true, cell: (p) => formatInt(p.sessions) },
          ]}
          empty={<>No page data in this range. Widen the date range above.</>}
        />
      </section>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Acquisition
// ────────────────────────────────────────────────────────────────────────────

async function AcquisitionTab({ range }: { range: { startDate: string; endDate: string } }) {
  const d = await fetchAcquisition(range)
  const totalAttributed = d.paidVsOrganic.paidSessions + d.paidVsOrganic.organicSessions + d.paidVsOrganic.otherSessions

  const chartSources = d.sources.slice(0, 10).map((s) => ({
    sourceMedium: s.sourceMedium,
    leads: s.leadEvents,
    sessions: s.sessions,
  }))

  return (
    <>
      <Figures
        figures={[
          {
            label: 'Paid sessions',
            value: formatInt(d.paidVsOrganic.paidSessions),
            caption: totalAttributed > 0 ? formatPct(d.paidVsOrganic.paidSessions / totalAttributed) : null,
          },
          {
            label: 'Organic sessions',
            value: formatInt(d.paidVsOrganic.organicSessions),
            caption: totalAttributed > 0 ? formatPct(d.paidVsOrganic.organicSessions / totalAttributed) : null,
          },
          {
            label: 'Direct / other',
            value: formatInt(d.paidVsOrganic.otherSessions),
            caption: totalAttributed > 0 ? formatPct(d.paidVsOrganic.otherSessions / totalAttributed) : null,
          },
        ]}
      />

      <section aria-label="Top sources by lead volume">
        <SectionHead>Top sources by lead volume</SectionHead>
        {chartSources.length === 0 ? (
          <div className="av2-empty">No source attribution in this range. Widen the date range above.</div>
        ) : (
          <HorizontalBarChart data={chartSources} xKey="sourceMedium" yKey="leads" height={Math.max(280, chartSources.length * 28)} />
        )}
      </section>

      <section aria-label="Top UTM combinations">
        <SectionHead>Top UTM combinations</SectionHead>
        <DataList
          label="Top UTM combinations"
          rows={d.sources}
          cap={10}
          rowKey={(s) => s.sourceMedium}
          columns={[
            { key: 'source', header: 'Source / Medium', lead: true, cell: (s) => s.sourceMedium },
            { key: 'sessions', header: 'Sessions', num: true, cell: (s) => formatInt(s.sessions) },
            { key: 'users', header: 'Users', num: true, cell: (s) => formatInt(s.users) },
            { key: 'engaged', header: 'Engaged sessions', num: true, cell: (s) => formatInt(s.engagedSessions) },
            { key: 'leads', header: 'Leads', num: true, cell: (s) => formatInt(s.leadEvents) },
            { key: 'conv', header: 'Conversion rate', num: true, cell: (s) => formatPct(s.conversionRate, 2) },
          ]}
          empty={<>No source data in this range. Widen the date range, or check that the GA4 cron is writing source rows.</>}
        />
      </section>

      {d.channels.length > 0 && (
        <section aria-label="Social channel sessions">
          <SectionHead>Social channel sessions</SectionHead>
          <DataList
            label="Social channel sessions"
            rows={d.channels}
            cap={d.channels.length}
            rowKey={(c) => c.channel}
            columns={[
              { key: 'channel', header: 'Channel', lead: true, cell: (c) => c.channel },
              { key: 'sessions', header: 'Sessions', num: true, cell: (c) => formatInt(c.sessions) },
              { key: 'users', header: 'Users', num: true, cell: (c) => formatInt(c.users) },
              { key: 'engagement', header: 'Engagement rate', num: true, cell: (c) => formatPct(c.engagementRate) },
            ]}
            empty={<>No social channel sessions in this range.</>}
          />
        </section>
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Behavior
// ────────────────────────────────────────────────────────────────────────────

async function BehaviorTab({ range }: { range: { startDate: string; endDate: string } }) {
  const d = await fetchBehavior(range)

  return (
    <>
      <section aria-label="Top 20 pages by sessions">
        <SectionHead>Top 20 pages by sessions</SectionHead>
        <DataList
          label="Top 20 pages by sessions"
          rows={d.pages}
          cap={d.pages.length}
          rowKey={(p) => `${p.pagePath}|${p.pageTitle}`}
          columns={[
            { key: 'page', header: 'Page', lead: true, cell: (p) => p.pagePath },
            { key: 'title', header: 'Title', cell: (p) => p.pageTitle },
            { key: 'views', header: 'Views', num: true, cell: (p) => formatInt(p.views) },
            { key: 'users', header: 'Users', num: true, cell: (p) => formatInt(p.users) },
            { key: 'engagement', header: 'Avg. engagement', num: true, cell: (p) => formatDuration(p.avgEngagementTimeSeconds) },
          ]}
          empty={<>No page data in this range. Widen the date range above.</>}
        />
      </section>

      <section aria-label="Scroll-depth events">
        <SectionHead>Scroll-depth events</SectionHead>
        <p className="av2-note">
          Total scroll_depth events fired in this range. GA4 does not expose per-milestone breakdowns via the Data API aggregation used here — only the aggregate count is real.
        </p>
        {d.scrollTotal === 0 ? (
          <div className="av2-empty">No scroll_depth events in this range.</div>
        ) : (
          <Figures figures={[{ label: 'scroll_depth events', value: formatInt(d.scrollTotal) }]} />
        )}
      </section>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Funnel
// ────────────────────────────────────────────────────────────────────────────

async function FunnelTab({ range, lpVariant }: { range: { startDate: string; endDate: string }; lpVariant: string }) {
  const d = await fetchFunnel(range, lpVariant || undefined)
  const max = Math.max(1, ...d.steps.map((s) => s.count))

  return (
    <>
      <VariantControl variants={d.availableVariants} current={lpVariant} />

      <section aria-label="Lead path">
        <SectionHead>
          Lead path{lpVariant ? <> <StateWord state="accent">lp_variant = {lpVariant}</StateWord></> : null}
        </SectionHead>
        <div style={{ marginBottom: 'var(--a-s4)' }}>
          {d.steps.map((step, i) => {
            const widthPct = (step.count / max) * 100
            return (
              <div key={step.label} className="av2-step">
                <div className="av2-step__l">{i + 1}. {step.label}</div>
                <div className="av2-step__track">
                  <div className="av2-step__fill" style={{ width: `${Math.max(2, widthPct)}%` }} />
                </div>
                <div className="av2-step__n">
                  <b style={{ color: 'var(--a-text)' }}>{formatInt(step.count)}</b>
                  {step.dropOffPct !== null ? (
                    <>
                      {' · '}
                      {step.dropOffPct >= 0
                        ? `drop ${formatPct(step.dropOffPct, 1)}`
                        : `gain ${formatPct(-step.dropOffPct, 1)}`}
                    </>
                  ) : (
                    <>{' · '}start</>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="av2-note">
          Steps 1 through 5 from GA4. Step 6 (leads captured) from public.crm_people, inbound sources only. Step 7 from public.cmas where status is delivered, final, or sent.
        </p>
      </section>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Conversions
// ────────────────────────────────────────────────────────────────────────────

async function ConversionsTab({ range }: { range: { startDate: string; endDate: string } }) {
  const d = await fetchConversions(range)

  return (
    <>
      <Figures
        figures={[
          {
            label: 'Total leads (CRM)',
            value: formatInt(d.brokerSplit.reduce((sum, b) => sum + b.count, 0)),
            caption: 'Inbound leads captured in the CRM',
          },
          {
            label: 'Cost per lead',
            value: d.costPerLeadUsd === null ? 'no data' : formatUsd(d.costPerLeadUsd),
            caption: d.costPerLeadUsd === null ? 'Meta spend not synced for this range' : 'Meta spend ÷ CRM leads',
          },
          {
            label: 'Top broker',
            value: d.brokerSplit[0]?.broker ?? 'no data',
            caption: d.brokerSplit[0] ? `${formatInt(d.brokerSplit[0].count)} leads` : null,
          },
        ]}
      />

      <section aria-label="Leads by source">
        <SectionHead>Leads by source</SectionHead>
        <DataList
          label="Leads by source"
          rows={d.leadsBySource}
          cap={d.leadsBySource.length}
          rowKey={(s) => s.sourceMedium}
          columns={[
            { key: 'source', header: 'Source / Medium', lead: true, cell: (s) => s.sourceMedium },
            { key: 'leads', header: 'Lead events', num: true, cell: (s) => formatInt(s.leadEvents) },
            { key: 'users', header: 'Users', num: true, cell: (s) => formatInt(s.users) },
          ]}
          empty={<>No attributed lead sources in this range.</>}
        />
      </section>

      <section aria-label="Broker attribution">
        <SectionHead>Broker attribution</SectionHead>
        {d.brokerSplit.length === 0 ? (
          <div className="av2-empty">No broker assignments in this range.</div>
        ) : (
          <BrokerPieChart data={d.brokerSplit} />
        )}
      </section>

      <section aria-label="Lead channel mix">
        <SectionHead>Lead channel mix</SectionHead>
        {d.classificationMix.length === 0 ? (
          <div className="av2-empty">No leads captured in this range.</div>
        ) : (
          <StackedBarMix data={d.classificationMix} />
        )}
      </section>

      <section aria-label="Sessions and leads over time">
        <SectionHead>Sessions and leads over time</SectionHead>
        {d.timeSeries.length === 0 ? (
          <div className="av2-empty">
            No daily snapshots in this range. The GA4 cron writes one row per day to public.marketing_channel_daily.
          </div>
        ) : (
          <TimeSeriesChart
            data={d.timeSeries}
            series={[
              { key: 'sessions', label: 'Sessions' },
              { key: 'leads',    label: 'Leads' },
            ]}
          />
        )}
      </section>
    </>
  )
}
