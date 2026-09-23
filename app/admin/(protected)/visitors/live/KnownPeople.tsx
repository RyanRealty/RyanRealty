/**
 * Known people — the identified contacts who were on the site in the window,
 * most recent first, each with the pages they looked at (P7 identity loop,
 * Matt 2026-09-23: "When I go and see who's been active, I can see, 'Okay, this
 * person's been active' ... exactly what they're looking at").
 *
 * Server component. Data: getActiveKnownPeople (lib/data/crm/getSiteActivity.ts)
 * over visitor_sessions.crm_person_id, which the identity loop stamps from a
 * signed tracked link, a sign-in, a form fill, or a returning known browser.
 * Automation-flagged sessions are excluded once migration 20260923120000 is
 * applied; the footnote says which state the read is in. Contacts the p06
 * intake screen reads as scripted form submits (quality:suspect) are left off
 * and counted in the footnote.
 */
import Link from 'next/link'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { SiteActivityVisits } from '../_components/SiteActivityVisits'
import { getActiveKnownPeople, type ActivityWindowDays } from '@/lib/data/crm/getSiteActivity'
import { identifiedViaLabel } from '@/lib/crm/site-activity'
import { agoLabel } from '@/lib/format/relative-ago'

const WINDOW_WORDS: Record<ActivityWindowDays, string> = {
  1: 'in the last 24 hours',
  7: 'in the last 7 days',
  30: 'in the last 30 days',
}

export async function KnownPeople({ days }: { days: ActivityWindowDays }) {
  const result = await getActiveKnownPeople({ days, limit: 50 })
  const nowMs = Date.now()
  const n = result.people.length

  return (
    <>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={n > 0 ? 'attention' : 'ok'}>
          <b>
            {n} known {n === 1 ? 'person' : 'people'} on the site {WINDOW_WORDS[days]}.
          </b>{' '}
          Most recent first. Open a name for their record.
        </VerdictLine>
      </div>

      <SectionHead>Known people</SectionHead>
      {n === 0 ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Nobody identified was on the site {WINDOW_WORDS[days]}. People are identified when they click a link we
          sent them, sign in, or fill in a form.
        </p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {result.people.map((p) => (
            <li
              key={p.personId}
              style={{ borderTop: '1px solid var(--a-border)', padding: '14px 0' }}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" style={{ marginBottom: 8 }}>
                <Link
                  href={`/admin/people/${p.personId}#site-activity`}
                  style={{ color: 'var(--a-accent)', fontWeight: 600, fontSize: 'var(--a-text-md)' }}
                >
                  {p.name}
                </Link>
                <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                  {[p.stage, p.assignedBroker ? `with ${p.assignedBroker}` : null].filter(Boolean).join(' · ')}
                </span>
                <span
                  className="tabular-nums"
                  style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginLeft: 'auto' }}
                >
                  last seen {agoLabel(p.lastSeenAt, nowMs)} · {p.visits.length}{' '}
                  {p.visits.length === 1 ? 'visit' : 'visits'} · {p.pageViews}{' '}
                  {p.pageViews === 1 ? 'page' : 'pages'} · {p.listingViews}{' '}
                  {p.listingViews === 1 ? 'home' : 'homes'}
                </span>
              </div>
              <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 6px' }}>
                Known because they {identifiedViaLabel(p.identifiedVia)}.
              </p>
              <SiteActivityVisits visits={p.visits} listings={result.listings} maxPages={8} />
            </li>
          ))}
        </ol>
      )}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Up to 50 people. {result.sessionsInWindow} identified{' '}
        {result.sessionsInWindow === 1 ? 'session' : 'sessions'} {WINDOW_WORDS[days]}.{' '}
        {result.automationFilterApplied
          ? 'Sessions flagged as automation (crawlers, headless browsers, scanners) are left out.'
          : 'The automation flag is not in the database yet, so crawler sessions are not filtered here.'}{' '}
        {result.suspectPeopleHidden > 0
          ? `${result.suspectPeopleHidden} more ${
              result.suspectPeopleHidden === 1 ? 'contact was' : 'contacts were'
            } left out because the intake screen reads them as scripted form submits (tagged quality:suspect); remove the tag on a record to bring it back. `
          : ''}
        Time on page runs to the next page they opened; the last page of a visit shows as an exit page.
        {result.truncated ? ' Older activity was cut off by a row cap.' : ''}
      </p>
    </>
  )
}
