/**
 * Website — the default view of /admin/analytics (Matt 2026-10-14: ONE page
 * that "actually makes sense", read on a phone). Eight cards, each answering
 * one question in plain words, each figure labelled with its window and where
 * it comes from, each with "More detail" doors to the deeper pages.
 *
 *   1. This week at a glance   getWebsiteVisitors + getLeadIntake
 *   2. Where visitors are      getWebsiteVisitors (geo)
 *   3. What they look at       getWebsiteMarkets + getListingPerformance
 *   4. Buying or selling       getWebsiteVisitors (intent, intentSplit.ts)
 *   5. Where they came from    getLeadSources (first-touch channels)
 *   6. Who reached out         getLeadIntake (inbound only)
 *   7. Google search           getGscDaily + getGscAccountTotals + getGscScopeAggregate
 *   8. Google Business Profile getGbpDaily
 *
 * Every read is a lib/data DAL call; each card streams on its own (Suspense),
 * so a slow source never blanks the page, and a failed read says so in place
 * instead of showing a zero (§0). Per-figure trace: ../citations.json "website".
 */
import { Suspense, cache } from 'react'
import Link from 'next/link'
import { AChart, Panel } from '@/components/admin/v2'
import { DataList, Figures, Loading, Trouble } from './v2/kit'
import {
  CHANNEL_PLAIN,
  addDays,
  byChannelOrder,
  changeWords,
  int,
  lastFullDays,
  positionWords,
  rangeQuery,
  rangeWords,
  share,
  shortDay,
  windowEndingOn,
  type WindowPair,
} from '../_lib/website'
import { getWebsiteVisitors } from '@/lib/data/analytics/getWebsiteVisitors'
import { getWebsiteMarkets } from '@/lib/data/analytics/getWebsiteMarkets'
import { getListingPerformance } from '@/lib/data/analytics/getListingPerformance'
import { getLeadSources } from '@/lib/data/analytics/leadSources'
import { getLeadIntake } from '@/lib/data'
import { getGscAccountTotals, getGscDaily, getGscScopeAggregate } from '@/lib/data/analytics/getGscMetrics'
import { getGbpDaily, latestGbpDate, summarizeGbp } from '@/lib/data/analytics/getGbpMetrics'
import { listingLabelFromUrl } from '@/lib/data/analytics/websiteMarkets'
import { personHref, personName } from '@/lib/data/analytics/salesFunnelRead'
import { brokerDisplayName } from '@/lib/brokers/directory'

/** One read of the visitors window per request, shared by three cards. */
const visitorsFor = cache((curStart: string, curEnd: string, prevStart: string, prevEnd: string) =>
  getWebsiteVisitors({
    current: { startIso: curStart, endIso: curEnd },
    previous: { startIso: prevStart, endIso: prevEnd },
  }),
)

function visitors(w: WindowPair) {
  return visitorsFor(w.current.startIso, w.current.endIso, w.previous.startIso, w.previous.endIso)
}

/** One lead read per window per request. */
const leadsFor = cache((startIso: string, endIso: string) => getLeadIntake({ startIso, endIso }))

/** What a card says about itself: the plain question it answers, in one line. */
function Means({ children }: { children: React.ReactNode }) {
  return <p className="av2-note">{children}</p>
}

/** Window + source, in words, under every card. */
function Source({ children }: { children: React.ReactNode }) {
  return <p className="av2-stamp av2-web__source">{children}</p>
}

function More({ links }: { links: Array<{ href: string; label: string }> }) {
  return (
    <p className="av2-web__more">
      More detail:{' '}
      {links.map((l, i) => (
        <span key={l.href}>
          {i > 0 ? ' · ' : null}
          <Link href={l.href}>{l.label}</Link>
        </span>
      ))}
    </p>
  )
}

function Card({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <Panel id={id} title={title}>
      {children}
    </Panel>
  )
}

/** A card's own loading state: the frame stays, so the page does not jump. */
function Waiting({ id, title, what }: { id: string; title: string; what: string }) {
  return (
    <Card id={id} title={title}>
      <Loading what={what} />
    </Card>
  )
}

// ─── 1. This week at a glance ───────────────────────────────────────────────

async function GlanceCard({ w }: { w: WindowPair }) {
  const [v, now, before] = await Promise.all([
    visitors(w),
    leadsFor(w.current.startIso, w.current.endIso),
    leadsFor(w.previous.startIso, w.previous.endIso),
  ])
  const title = 'This week at a glance'
  return (
    <Card id="web-glance" title={title}>
      <Means>How many people came to the site in the last 7 full days, and how many reached out.</Means>
      {v.unreadable ? (
        <Trouble>Could not read our site tracking just now ({v.errorMessage}). Reload in a minute.</Trouble>
      ) : (
        <Figures
          figures={[
            { label: 'Visits', value: int(v.current.visits), caption: changeWords(v.current.visits, v.previous.visits) },
            {
              label: 'Looked around',
              value: int(v.current.engagedVisits),
              caption: changeWords(v.current.engagedVisits, v.previous.engagedVisits),
            },
            {
              label: 'Came back',
              value: int(v.current.cameBack),
              caption: changeWords(v.current.cameBack, v.previous.cameBack),
            },
            now.unreadable
              ? { label: 'New leads', value: 'not read', caption: 'The CRM could not be read just now' }
              : {
                  label: 'New leads',
                  value: int(now.inboundLeads),
                  caption: before.unreadable ? null : changeWords(now.inboundLeads, before.inboundLeads),
                  href: '#web-leads',
                },
          ]}
        />
      )}
      <ul className="av2-web__defs">
        <li>
          <b>Visits</b>: each time someone opened the site.
        </li>
        <li>
          <b>Looked around</b>: visits that did more than open one page and leave, for example two listings, a selling
          page, or a tap on a contact button (the bar the sales funnel calls engaged). Most visits open one page and
          leave, so this is the better read on real shoppers.
        </li>
        <li>
          <b>Came back</b>: browsers that visited two or more times in these 7 days.
        </li>
        <li>
          <b>New leads</b>: people who contacted us or signed up, from the CRM. Lists we import for outreach are not
          counted.
        </li>
      </ul>
      <Source>
        {rangeWords(w.current)}, compared with {rangeWords(w.previous)}. Visits are from our own site tracking, which
        counts everyone except people who decline cookies or turn on a do-not-track setting.
        {v.unreadable ? null : (
          <> Crawlers and scripts are left out ({int(v.current.automatedLeftOut)} visits this week).</>
        )}
      </Source>
      <More
        links={[
          { href: `/admin/analytics/funnel-breakdown?${rangeQuery(w.current)}`, label: 'Visits by source and intent' },
          { href: '/admin/reports/leads', label: 'Leads report' },
        ]}
      />
    </Card>
  )
}

// ─── 2. Where visitors are ──────────────────────────────────────────────────

async function WhereCard({ w }: { w: WindowPair }) {
  const v = await visitors(w)
  const total = v.current.visits
  return (
    <Card id="web-where" title="Where visitors are">
      <Means>
        Where each visit came from, by the visitor&apos;s internet connection: Central Oregon, the rest of Oregon, other
        states, or other countries.
      </Means>
      {v.unreadable ? (
        <Trouble>Could not read our site tracking just now ({v.errorMessage}). Reload in a minute.</Trouble>
      ) : total === 0 ? (
        <div className="av2-empty">No visits recorded for {rangeWords(w.current)} yet.</div>
      ) : (
        <>
          <DataList
            label="Visits by area"
            rows={v.geo.buckets}
            cap={v.geo.buckets.length}
            rowKey={(b) => b.bucket}
            columns={[
              { key: 'area', header: 'Area', lead: true, cell: (b) => b.label },
              { key: 'visits', header: 'Visits', num: true, cell: (b) => int(b.visits) },
              { key: 'share', header: 'Share', num: true, cell: (b) => share(b.visits, total) ?? '' },
              { key: 'engaged', header: 'Looked around', num: true, cell: (b) => int(b.engaged) },
            ]}
            empty={<>No visits in this window.</>}
          />
          <h4 className="av2-web__sub">Top cities</h4>
          <DataList
            label="Top cities"
            rows={v.geo.topCities}
            cap={10}
            rowKey={(c) => c.key}
            columns={[
              {
                key: 'city',
                header: 'City',
                lead: true,
                cell: (c) => (c.bucket === 'central_oregon' ? <>{c.label} (local)</> : c.label),
              },
              { key: 'visits', header: 'Visits', num: true, cell: (c) => int(c.visits) },
              { key: 'engaged', header: 'Looked around', num: true, cell: (c) => int(c.engaged) },
            ]}
            empty={<>No visit in this window carried a city.</>}
          />
          <h4 className="av2-web__sub">Top states</h4>
          <DataList
            label="Top states"
            rows={v.geo.topStates}
            cap={8}
            rowKey={(s) => s.key}
            columns={[
              { key: 'state', header: 'State', lead: true, cell: (s) => s.label },
              { key: 'visits', header: 'Visits', num: true, cell: (s) => int(s.visits) },
              { key: 'engaged', header: 'Looked around', num: true, cell: (s) => int(s.engaged) },
            ]}
            empty={<>No US visit in this window carried a state.</>}
          />
          {v.geo.topCountries.length > 0 ? (
            <p className="av2-note">
              Other countries:{' '}
              {v.geo.topCountries.map((c) => `${c.label} ${int(c.visits)}`).join(', ')}.
            </p>
          ) : null}
        </>
      )}
      <Source>
        {rangeWords(w.current)}, our own site tracking, crawlers left out.
        {v.unreadable || total === 0 ? null : (
          <>
            {' '}
            Location is known for {int(v.geo.located)} of {int(total)} visits. It is kept only when a visitor allows
            analytics, so visits from Europe, the UK and Switzerland, and connections that do not say where they are,
            have none. A phone on a cell network can show up in a bigger city nearby.
          </>
        )}
      </Source>
      <More links={[{ href: '/admin/analytics/demographics', label: 'Google Analytics audience' }]} />
    </Card>
  )
}

// ─── 3. What they look at ───────────────────────────────────────────────────

async function LookCard({ w }: { w: WindowPair }) {
  const [m, lp] = await Promise.all([
    getWebsiteMarkets({ startIso: w.current.startIso, endIso: w.current.endIso }),
    getListingPerformance({ startDate: w.current.startDate, endDate: w.current.endDate, humanOnly: true }),
  ])
  return (
    <Card id="web-look" title="What they look at">
      <Means>
        Which towns people browse (homes for sale, listings and town pages), and the listings they open most.
      </Means>
      <h4 className="av2-web__sub">Top markets</h4>
      {m.unreadable ? (
        <Trouble>Could not read page views just now ({m.errorMessage}). Reload in a minute.</Trouble>
      ) : (
        <DataList
          label="Top markets"
          rows={m.rows}
          cap={10}
          rowKey={(r) => r.citySlug}
          columns={[
            {
              key: 'market',
              header: 'Market',
              lead: true,
              cell: (r) => (r.local ? r.city : <>{r.city} (outside our area)</>),
            },
            { key: 'views', header: 'Page views', num: true, cell: (r) => int(r.views) },
            { key: 'listings', header: 'Listing views', num: true, cell: (r) => int(r.listingViews) },
            { key: 'visits', header: 'Visits', num: true, cell: (r) => int(r.visitors) },
          ]}
          empty={<>No page about a town was viewed in {rangeWords(w.current)}.</>}
        />
      )}
      <h4 className="av2-web__sub">Most viewed listings</h4>
      {lp.unreadable ? (
        <Trouble>Could not read listing views just now ({lp.errorMessage}). Reload in a minute.</Trouble>
      ) : (
        <DataList
          label="Most viewed listings"
          rows={lp.rows}
          cap={8}
          rowKey={(r) => r.mls}
          columns={[
            {
              key: 'listing',
              header: 'Listing',
              lead: true,
              cell: (r) => {
                const label =
                  (r.address && r.city ? `${r.address}, ${r.city}` : r.address) ||
                  listingLabelFromUrl(r.pageUrl) ||
                  `MLS ${r.mls}`
                return r.pageUrl ? (
                  <a href={r.pageUrl} target="_blank" rel="noreferrer">
                    {label}
                  </a>
                ) : (
                  label
                )
              },
            },
            { key: 'views', header: 'Views', num: true, cell: (r) => int(r.views) },
            { key: 'visits', header: 'Visits', num: true, cell: (r) => int(r.uniqueVisitors) },
          ]}
          empty={<>No listing was viewed in {rangeWords(w.current)}.</>}
        />
      )}
      <h4 className="av2-web__sub">Searched on the site</h4>
      {m.unreadable ? null : m.searchEvents === 0 ? (
        <div className="av2-empty">
          Nobody used the site&apos;s search box in {rangeWords(w.current)}. The markets above come from the homes-for-sale
          pages people opened; the Google search card shows what people searched on Google.
        </div>
      ) : (
        <>
          <DataList
            label="Searched on the site"
            rows={m.searches}
            cap={8}
            rowKey={(r) => r.term.toLowerCase()}
            columns={[
              { key: 'term', header: 'Typed', lead: true, cell: (r) => r.term },
              { key: 'n', header: 'Searches', num: true, cell: (r) => int(r.searches) },
            ]}
            empty={<>The search box was used, but no typed place was kept (visitors who have not allowed analytics).</>}
          />
          <p className="av2-stamp">
            {int(m.searchEvents)} searches in the site&apos;s search box. What was typed is kept only for visitors who allow
            analytics.
          </p>
        </>
      )}
      <Source>
        {rangeWords(w.current)}, our own site tracking, crawlers left out.
        {m.unreadable ? null : (
          <>
            {' '}
            {int(m.marketViews)} of {int(m.pageViews)} page views named a town. Community, subdivision and blog pages do
            not, and are ranked under Place popularity.
          </>
        )}
      </Source>
      <More
        links={[
          { href: '/admin/reports/place-popularity?window=7', label: 'Place popularity' },
          { href: `/admin/analytics/listing-performance?${rangeQuery(w.current)}`, label: 'Listing performance' },
        ]}
      />
    </Card>
  )
}

// ─── 4. Buying or selling ───────────────────────────────────────────────────

async function IntentCard({ w }: { w: WindowPair }) {
  const v = await visitors(w)
  const total = v.current.visits
  return (
    <Card id="web-intent" title="Buying, selling, or just browsing">
      <Means>What each visit was after, judged by the pages it opened.</Means>
      {v.unreadable ? (
        <Trouble>Could not read our site tracking just now ({v.errorMessage}). Reload in a minute.</Trouble>
      ) : total === 0 ? (
        <div className="av2-empty">No visits recorded for {rangeWords(w.current)} yet.</div>
      ) : (
        <DataList
          label="Visits by intent"
          rows={v.intent}
          cap={v.intent.length}
          rowKey={(r) => r.intent}
          columns={[
            {
              key: 'group',
              header: 'Group',
              lead: true,
              cell: (r) => (
                <>
                  {r.label}
                  <span className="av2-web__hint">{r.meaning}</span>
                </>
              ),
            },
            { key: 'visits', header: 'Visits', num: true, cell: (r) => int(r.visits) },
            { key: 'share', header: 'Share', num: true, cell: (r) => share(r.visits, total) ?? '' },
            { key: 'engaged', header: 'Looked around', num: true, cell: (r) => int(r.engaged) },
          ]}
          empty={<>No visits in this window.</>}
        />
      )}
      <Source>{rangeWords(w.current)}, our own site tracking, crawlers left out. The same groups as the funnel breakdown.</Source>
      <More
        links={[
          { href: `/admin/analytics/funnel-breakdown?${rangeQuery(w.current)}`, label: 'Funnel breakdown' },
          { href: `/admin/analytics?tab=funnel&audience=seller&${rangeQuery(w.current)}`, label: 'Seller funnel' },
          { href: `/admin/analytics?tab=funnel&audience=buyer&${rangeQuery(w.current)}`, label: 'Buyer funnel' },
        ]}
      />
    </Card>
  )
}

// ─── 5. Where they came from ────────────────────────────────────────────────

async function SourcesCard({ w }: { w: WindowPair }) {
  let report: Awaited<ReturnType<typeof getLeadSources>> | null = null
  let failure: string | null = null
  try {
    report = await getLeadSources(w.current.startIso, w.current.endIso, { humanOnly: true })
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e)
  }
  const total = report?.totals.sessions ?? 0
  const rows = report ? byChannelOrder(report.rows) : []
  const noSource = report?.totals.directSessions ?? 0
  return (
    <Card id="web-sources" title="Where they came from">
      <Means>What brought each visit to the site: the link someone clicked, or the site that sent them.</Means>
      {failure ? (
        <Trouble>Could not read our site tracking just now ({failure}). Reload in a minute.</Trouble>
      ) : total === 0 ? (
        <div className="av2-empty">No visits recorded for {rangeWords(w.current)} yet.</div>
      ) : (
        <>
          <Figures
            figures={[
              {
                label: 'No source we can see',
                value: share(noSource, total) ?? '',
                caption: `${int(noSource)} of ${int(total)} visits: typed the address, used a bookmark, or a browser that hides the link`,
              },
            ]}
          />
          <DataList
            label="Visits by source"
            rows={rows}
            cap={rows.length}
            rowKey={(r) => r.channel}
            columns={[
              { key: 'channel', header: 'Came from', lead: true, cell: (r) => CHANNEL_PLAIN[r.channel] },
              { key: 'visits', header: 'Visits', num: true, cell: (r) => int(r.sessions) },
              { key: 'share', header: 'Share', num: true, cell: (r) => share(r.sessions, total) ?? '' },
              { key: 'people', header: 'Known people', num: true, cell: (r) => int(r.people) },
              {
                key: 'origin',
                header: 'Top site or tag',
                cell: (r) => (r.channel === 'Direct' ? '' : r.topOrigins[0]?.origin ?? ''),
              },
            ]}
            empty={<>No visits in this window.</>}
          />
        </>
      )}
      <Source>
        {rangeWords(w.current)}, our own site tracking, crawlers left out. Each visit counts where it started. Known
        people are contacts in the CRM whose first visit in these 7 days came that way.
      </Source>
      <More
        links={[
          { href: `/admin/analytics?tab=acquisition&${rangeQuery(w.current)}`, label: 'Sources in depth' },
          { href: '/admin/reports/traffic-sources', label: 'Traffic sources' },
          { href: '/admin/analytics/social', label: 'Social' },
        ]}
      />
    </Card>
  )
}

// ─── 6. Who reached out ─────────────────────────────────────────────────────

function brokerName(slug: string): string {
  return slug === 'unassigned' ? 'Not assigned' : brokerDisplayName(slug) || slug
}

async function LeadsCard({ w }: { w: WindowPair }) {
  const [now, before] = await Promise.all([
    leadsFor(w.current.startIso, w.current.endIso),
    leadsFor(w.previous.startIso, w.previous.endIso),
  ])
  const channels = now.byChannel.filter((c) => c.attributable)
  return (
    <Card id="web-leads" title="Who reached out">
      <Means>
        People who contacted us or signed up, where they came from, which form or path they used, and who has them.
      </Means>
      {now.unreadable ? (
        <Trouble>Could not read the CRM just now. Reload in a minute.</Trouble>
      ) : now.inboundLeads === 0 ? (
        <div className="av2-empty">No new leads in {rangeWords(w.current)}.</div>
      ) : (
        <>
          <Figures
            figures={[
              {
                label: 'New leads',
                value: int(now.inboundLeads),
                caption: before.unreadable ? null : changeWords(now.inboundLeads, before.inboundLeads),
              },
            ]}
          />
          <h4 className="av2-web__sub">The newest</h4>
          <DataList
            label="Newest leads"
            rows={now.recent}
            cap={10}
            rowKey={(r) => r.id}
            columns={[
              {
                key: 'name',
                header: 'Person',
                lead: true,
                cell: (r) => <Link href={personHref(r.id)}>{personName({ id: r.id, name: r.name })}</Link>,
              },
              { key: 'door', header: 'Came in through', cell: (r) => r.doorLabel },
              { key: 'broker', header: 'Broker', cell: (r) => brokerName(r.broker) },
              { key: 'when', header: 'Day', num: true, cell: (r) => shortDay(r.createdAt.slice(0, 10)) },
            ]}
            empty={<>No new leads in this window.</>}
          />
          <h4 className="av2-web__sub">Where they came from</h4>
          <DataList
            label="Leads by source"
            rows={channels}
            cap={channels.length}
            rowKey={(c) => c.channel}
            columns={[
              { key: 'channel', header: 'Source', lead: true, cell: (c) => c.label },
              { key: 'count', header: 'Leads', num: true, cell: (c) => int(c.count) },
            ]}
            empty={<>No source recorded.</>}
          />
          <h4 className="av2-web__sub">Form or path</h4>
          <DataList
            label="Leads by form or path"
            rows={now.byDoor}
            cap={now.byDoor.length}
            rowKey={(d) => d.door}
            columns={[
              { key: 'door', header: 'Form or path', lead: true, cell: (d) => d.label },
              { key: 'count', header: 'Leads', num: true, cell: (d) => int(d.count) },
            ]}
            empty={<>No form recorded.</>}
          />
          <h4 className="av2-web__sub">By broker</h4>
          <DataList
            label="Leads by broker"
            rows={now.byBroker}
            cap={now.byBroker.length}
            rowKey={(b) => b.broker}
            columns={[
              { key: 'broker', header: 'Broker', lead: true, cell: (b) => brokerName(b.broker) },
              { key: 'count', header: 'Leads', num: true, cell: (b) => int(b.count) },
            ]}
            empty={<>No broker assigned.</>}
          />
        </>
      )}
      <Source>
        {rangeWords(w.current)}, from the CRM: people created in these 7 days who came to us (website, phone and text,
        portals, social, referrals).
        {now.unreadable ? null : (
          <> {int(now.outreachAdded)} people added from outreach lists are not counted as leads.</>
        )}
      </Source>
      <More
        links={[
          { href: '/admin/reports/leads', label: 'Leads report' },
          { href: '/admin/crm/reporting/lead-sources', label: 'Lead sources' },
          { href: `/admin/analytics?tab=conversions&${rangeQuery(w.current)}`, label: 'Leads over time' },
        ]}
      />
    </Card>
  )
}

// ─── 7. Google search ───────────────────────────────────────────────────────

/** Query rows are stored as "query:<text>" (the GSC snapshot cron). */
function searchText(key: string): string {
  return key.startsWith('query:') ? key.slice(6) : key
}

async function SearchCard({ today }: { today: string }) {
  const lookback = await getGscDaily(addDays(today, -45), today)
  // A day Google has not reported yet is stored as all zeros; skip it.
  const reported = lookback.days.filter((d) => d.reported)
  const latest = reported.length > 0 ? reported[reported.length - 1].date : null
  if (lookback.unreadable || !latest) {
    return (
      <Card id="web-search" title="Google search">
        <Means>How often the site shows up in Google, and how often people click.</Means>
        {lookback.unreadable ? (
          <Trouble>Could not read the Search Console figures just now. Reload in a minute.</Trouble>
        ) : (
          <div className="av2-empty">No Search Console data in the last 45 days yet.</div>
        )}
        <More links={[{ href: '/admin/analytics/google-search', label: 'Google search' }]} />
      </Card>
    )
  }
  const w = windowEndingOn(latest, 7)
  const [cur, prev, queries] = await Promise.all([
    getGscAccountTotals(w.current.startDate, w.current.endDate),
    getGscAccountTotals(w.previous.startDate, w.previous.endDate),
    getGscScopeAggregate('campaign', w.current.startDate, w.current.endDate),
  ])
  const trendStart = addDays(latest, -27)
  const trend = reported.filter((d) => d.date >= trendStart)
  const topQueries = [...queries.rows]
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 8)
  return (
    <Card id="web-search" title="Google search">
      <Means>
        How often the site shows up in Google, how often people click, and the searches that bring them. Google reports
        2 to 3 days late, so this covers the newest 7 days it has.
      </Means>
      {cur.unreadable ? (
        <Trouble>Could not read the Search Console totals just now. Reload in a minute.</Trouble>
      ) : (
        <Figures
          figures={[
            {
              label: 'Clicks from Google',
              value: int(cur.clicks),
              caption: prev.unreadable ? null : changeWords(cur.clicks, prev.clicks),
            },
            {
              label: 'Times shown in Google',
              value: int(cur.impressions),
              caption: prev.unreadable ? null : changeWords(cur.impressions, prev.impressions),
            },
            {
              label: 'Average position',
              value: cur.pos > 0 ? cur.pos.toFixed(1) : 'not reported',
              caption: prev.unreadable ? null : positionWords(cur.pos, prev.pos) || null,
            },
          ]}
        />
      )}
      <AChart
        id="web-search-trend"
        caption={`Clicks from Google per day, ${shortDay(trend[0]?.date ?? trendStart)} to ${shortDay(latest)}`}
        kind="line"
        series={[
          {
            name: 'Clicks',
            points: trend.map((d) => ({ value: d.clicks, tick: shortDay(d.date), label: `${int(d.clicks)} clicks` })),
          },
        ]}
        emptyReason="No daily Search Console figures in the last 4 weeks."
      />
      <h4 className="av2-web__sub">Top searches</h4>
      {queries.unreadable ? (
        <Trouble>Could not read the top searches just now. Reload in a minute.</Trouble>
      ) : (
        <DataList
          label="Top Google searches"
          rows={topQueries}
          cap={8}
          rowKey={(q) => q.key}
          columns={[
            { key: 'q', header: 'Search', lead: true, cell: (q) => searchText(q.key) },
            { key: 'clicks', header: 'Clicks', num: true, cell: (q) => int(q.clicks) },
            { key: 'shown', header: 'Shown', num: true, cell: (q) => int(q.impressions) },
            { key: 'pos', header: 'Position', num: true, cell: (q) => (q.position > 0 ? q.position.toFixed(1) : '') },
          ]}
          empty={<>No search shown in {rangeWords(w.current)}.</>}
        />
      )}
      <Source>
        Google Search Console, {rangeWords(w.current)} (the newest day Google has reported), compared with{' '}
        {rangeWords(w.previous)}. Position 1 is the top of the page; lower is better. Top searches add up the top 25 searches Google
        reports for each day.
      </Source>
      <More links={[{ href: `/admin/analytics/google-search?${rangeQuery(w.current)}`, label: 'Google search' }]} />
    </Card>
  )
}

// ─── 8. Google Business Profile ─────────────────────────────────────────────

async function GbpCard({ today }: { today: string }) {
  const { rows, unreadable } = await getGbpDaily(addDays(today, -45), today)
  const latest = latestGbpDate(rows)
  const title = 'Google Business Profile'
  if (unreadable || !latest) {
    return (
      <Card id="web-gbp" title={title}>
        <Means>What people did on the Ryan Realty profile in Google Search and Maps.</Means>
        {unreadable ? (
          <Trouble>Could not read the Business Profile figures just now. Reload in a minute.</Trouble>
        ) : (
          <div className="av2-empty">Google has not reported any Business Profile figures in the last 45 days.</div>
        )}
        <More links={[{ href: '/admin/analytics/google-business-profile', label: 'Business Profile' }]} />
      </Card>
    )
  }
  const w = windowEndingOn(latest, 7)
  const cur = summarizeGbp(rows, w.current.startDate, w.current.endDate)
  const prev = summarizeGbp(rows, w.previous.startDate, w.previous.endDate)
  const hasPrev = prev.reportedDays > 0
  const cmp = (a: number, b: number) => (hasPrev ? changeWords(a, b) : null)
  return (
    <Card id="web-gbp" title={title}>
      <Means>
        What people did on the Ryan Realty profile in Google Search and Maps. Google reports these several days late, so
        this covers the newest 7 days it has.
      </Means>
      <Figures
        figures={[
          { label: 'Calls', value: int(cur.calls), caption: cmp(cur.calls, prev.calls) },
          { label: 'Website clicks', value: int(cur.websiteClicks), caption: cmp(cur.websiteClicks, prev.websiteClicks) },
          {
            label: 'Direction requests',
            value: int(cur.directionRequests),
            caption: cmp(cur.directionRequests, prev.directionRequests),
          },
          { label: 'Times shown', value: int(cur.impressions), caption: cmp(cur.impressions, prev.impressions) },
        ]}
      />
      <Source>
        Google Business Profile, {rangeWords(w.current)} (the newest day Google has reported), compared with{' '}
        {rangeWords(w.previous)}. Google reported {cur.reportedDays} of these 7 days. Times shown counts Google Search and
        Maps, phone and computer.
      </Source>
      <More
        links={[{ href: `/admin/analytics/google-business-profile?${rangeQuery(w.current)}`, label: 'Business Profile' }]}
      />
    </Card>
  )
}

// ─── The view ───────────────────────────────────────────────────────────────

export function WebsiteView({ now = new Date() }: { now?: Date }) {
  const w = lastFullDays(now, 7)
  const today = now.toISOString().slice(0, 10)
  return (
    <>
      <p className="av2-note">
        The last 7 full days, {rangeWords(w.current)}, compared with the 7 days before. Google figures run a few days
        behind and say which days they cover.
      </p>
      <div className="av2-web">
        <Suspense fallback={<Waiting id="web-glance" title="This week at a glance" what="this week's visits" />}>
          <GlanceCard w={w} />
        </Suspense>
        <Suspense fallback={<Waiting id="web-leads" title="Who reached out" what="the CRM" />}>
          <LeadsCard w={w} />
        </Suspense>
        <Suspense fallback={<Waiting id="web-where" title="Where visitors are" what="visitor locations" />}>
          <WhereCard w={w} />
        </Suspense>
        <Suspense fallback={<Waiting id="web-look" title="What they look at" what="page views" />}>
          <LookCard w={w} />
        </Suspense>
        <Suspense fallback={<Waiting id="web-intent" title="Buying, selling, or just browsing" what="visits" />}>
          <IntentCard w={w} />
        </Suspense>
        <Suspense fallback={<Waiting id="web-sources" title="Where they came from" what="visit sources" />}>
          <SourcesCard w={w} />
        </Suspense>
        <Suspense fallback={<Waiting id="web-search" title="Google search" what="Search Console" />}>
          <SearchCard today={today} />
        </Suspense>
        <Suspense fallback={<Waiting id="web-gbp" title="Google Business Profile" what="Business Profile" />}>
          <GbpCard today={today} />
        </Suspense>
      </div>
    </>
  )
}
