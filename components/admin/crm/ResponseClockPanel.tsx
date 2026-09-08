import Link from 'next/link'
import {
  QueueRow,
  ReportNumbers,
  SectionHead,
  VerdictLine,
  asOfLabel,
  type ReportNumberItem,
} from '@/components/admin/v2'
import '@/components/admin/v2/admin-v2.css'
import { formatAge } from '@/lib/crm/response-clock'
import { getResponseClockReport } from '@/lib/data/crm/getResponseClockReport'

/**
 * The response clock, at the top of /admin/crm (SITE-09).
 *
 * ONE QUESTION, ANSWERED FIRST: is anybody who wrote to us today still waiting?
 * The list under it is the work — name, what they asked for, how long they have
 * been waiting against the five-minute mark, and a link straight to the person.
 * When nobody is waiting the panel says so in one line and gets out of the way
 * (ADMIN_UI pattern 3: healthy things earn near-zero visual weight).
 *
 * The 28-day row underneath is the measurement the node is graded on, and it
 * carries its own §0 trace: which table, which filter, which window, how many
 * rows. Every figure on this panel comes from getResponseClockReport, which
 * shares its population and its human-touch predicate with the cron — the panel
 * cannot disagree with the timer about who is untouched.
 */

const CRM_BROKER_DISPLAY: Record<string, string> = {
  matt: 'Matt',
  rebecca: 'Rebecca',
  paul: 'Paul',
}

function minutesLabel(seconds: number | null): string {
  if (seconds == null) return 'no reading'
  if (seconds < 60) return `${seconds}s`
  const minutes = seconds / 60
  return minutes < 10 ? `${minutes.toFixed(1)} min` : `${Math.round(minutes)} min`
}

export default async function ResponseClockPanel() {
  const report = await getResponseClockReport().catch(() => null)

  if (!report) {
    return (
      <section aria-label="Response clock" style={{ marginBottom: 'var(--a-s5)' }}>
        <SectionHead flush>Response clock</SectionHead>
        <VerdictLine tone="attention">
          <b>The response clock could not be read.</b> Nobody is being watched right now, so check
          every site submit by hand until it comes back.
        </VerdictLine>
      </section>
    )
  }

  const { waiting, liveWindowLeads, stats28d, sourceLine, generatedAt } = report
  const overdue = waiting.filter((w) => w.flag5mAt || w.flag24hAt).length
  // A quiet live window does not earn a green dot while site submits are still
  // sitting unanswered a month later. The 28-day backlog is the thing this whole
  // clock exists to kill, so it decides the tone too.
  const stale = stats28d.untouchedOver24h
  const tone = waiting.length === 0 && stale === 0 ? 'ok' : 'attention'
  const staleClause =
    stale > 0 ? (
      <>
        {' '}
        Further back, <b>{stale}</b> of the last 28 days&rsquo; {stats28d.leadsAllHours} site submits still
        have no human touch at all.
      </>
    ) : null

  // §0: a figure that cannot be verified does not ship. When every counted touch
  // predates the provenance stamp, the median rests entirely on rows that may be
  // system sends (the /book invite case), so the number is withheld rather than
  // shown with a caveat. The source line below still says why.
  const medianProven = stats28d.contacted > 0 && stats28d.unstampedTouches < stats28d.contacted
  const figures: ReportNumberItem[] = [
    {
      key: 'median',
      label: 'Median to a human, 8am–8pm',
      value: medianProven ? minutesLabel(stats28d.medianSeconds) : 'unproven',
    },
    { key: 'leads', label: 'Site submits counted', value: String(stats28d.leads) },
    { key: 'contacted', label: 'Answered by a person', value: String(stats28d.contacted) },
    { key: 'stale', label: 'Still untouched past 24h', value: String(stats28d.untouchedOver24h) },
  ]

  return (
    <section aria-label="Response clock" style={{ marginBottom: 'var(--a-s5)' }}>
      <SectionHead flush>Response clock</SectionHead>

      <VerdictLine tone={tone}>
        {waiting.length === 0 && liveWindowLeads === 0 ? (
          // "Every submit has a touch" over an empty set reads as a claim and is
          // not one. Say which of the two quiet states this actually is.
          <>
            <b>Nothing came in through the site in the last 24 hours.</b> Read at{' '}
            {asOfLabel(Date.parse(generatedAt))} Pacific.
            {staleClause}
          </>
        ) : waiting.length === 0 ? (
          <>
            <b>
              Every site submit in the last 24 hours has a human touch
              {liveWindowLeads === 1 ? '' : ` — all ${liveWindowLeads} of them`}.
            </b>{' '}
            Read at {asOfLabel(Date.parse(generatedAt))} Pacific.
            {staleClause}
          </>
        ) : (
          <>
            <b>
              {waiting.length} {waiting.length === 1 ? 'person is' : 'people are'} still waiting
            </b>
            {overdue > 0 ? <> · {overdue} past the five-minute mark</> : <> · all inside the window</>}.
            {staleClause}
          </>
        )}
      </VerdictLine>

      {waiting.length > 0 ? (
        <ul className="av2-queue">
          {waiting.map((w) => (
            <QueueRow
              key={w.personId}
              kind={w.flag24hAt ? 'A day' : w.flag5mAt ? 'Overdue' : 'Waiting'}
              kindTone={w.flag24hAt ? 'down' : w.flag5mAt ? 'slow' : 'waiting'}
              title={
                <Link href={w.href} style={{ color: 'var(--a-accent)' }}>
                  {w.name ?? `Contact #${w.personId}`}
                </Link>
              }
              context={`Asked for ${w.ask}${w.source ? ` · ${w.source}` : ''} · ${
                CRM_BROKER_DISPLAY[w.assignedBroker] ?? w.assignedBroker
              }`}
              age={formatAge(w.ageMinutes)}
              hot={Boolean(w.flag5mAt || w.flag24hAt)}
            />
          ))}
        </ul>
      ) : null}

      <ReportNumbers items={figures} />

      <p
        style={{
          fontSize: 'var(--a-text-xs)',
          color: 'var(--a-text-2)',
          margin: 'var(--a-s2) 0 0',
          maxWidth: '68ch',
        }}
      >
        Last 28 days. {sourceLine}
      </p>
    </section>
  )
}
