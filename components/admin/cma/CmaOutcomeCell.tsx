// @no-parity — internal admin surface, no public mockup contract.
/**
 * What happened after we sent it, as one line a broker can read at a glance.
 *
 * Stages, in the order they can only ever happen: sent → delivered → opened →
 * clicked → visited → replied. Delivered is marked receipt (Resend) or inferred
 * (Gmail: no bounce in 24h, or any open/click). A stage that has not happened
 * is dimmed rather than hidden.
 *
 * Colour carries exactly one meaning here. Reached stages are ordinary text;
 * `var(--a-ok)` marks the reply, the one stage that is a lead; and
 * `var(--a-danger)` is reserved for a bounce or an unsubscribe — the exception
 * accent, never decoration (design canon §3).
 *
 * "Visited" now means the document OR anything it linked to: every address,
 * place and CTA a CMA prints carries `utm_campaign=<slug>` through
 * `trackedDocLink`, so a tap on a comp belongs to that document. When there are
 * such pages the cell names them — which comps the seller opened is the part a
 * broker acts on, and a bare "visited 4" does not say it.
 *
 * Server component: no state, no data access. The page passes an already-read
 * CmaOutcome, so nothing here can move a number.
 */
import type { CmaOutcome } from '@/lib/data/cma/outcomes'
import { formatDateTime } from '@/lib/format/date'

export type CmaOutcomeCellProps = {
  outcome: CmaOutcome | null | undefined
  /**
   * 'row'  — one compact line for a queue row; stamps ride `title`.
   * 'panel'— stacked stages with their stamps written out, for a detail page
   *          where there is room and a phone has no hover.
   */
  variant?: 'row' | 'panel'
}

type Stage = {
  key: string
  label: string
  at: string | null
  count: number | null
  /** True once this stage has been reached. */
  done: boolean
  /** Extra the stamp should say — the pages a visit actually landed on. */
  detail?: string | null
}

/**
 * A path as a broker reads it. The last segment of a listing URL is the
 * address, which is the whole point of showing this: "they opened 1299 Ogden",
 * not "they opened /homes-for-sale/bend/newport-gardens/1299-ogden-220225388".
 */
export function pageLabel(path: string): string {
  const segments = path.split('/').filter(Boolean)
  const last = segments[segments.length - 1] ?? ''
  if (!last) return 'Home'
  // Canonical listing segment: "1299-ogden-220225388". Drop the MLS tail.
  const address = last.replace(/-(\d{6,})$/, '')
  return address.replace(/-/g, ' ')
}

/** Receipt (Resend) vs inferred (Gmail: no bounce in 24h, or any open/click). */
export function deliveredKind(inferred: boolean): 'inferred' | 'receipt' {
  return inferred ? 'inferred' : 'receipt'
}

/** The broker-readable click line: "clicked: report, Diamond Bar Ranch, reviews". */
export function clickedLine(links: CmaOutcome['clickedLinks'] | undefined): string | null {
  if (!links?.length) return null
  const labels: string[] = []
  for (const l of links) {
    if (!labels.includes(l.label)) labels.push(l.label)
  }
  return labels.length ? `clicked: ${labels.join(', ')}` : null
}

function stagesOf(o: CmaOutcome): Stage[] {
  const leftAt = cmaOutcomeLeftAt(o)
  return [
    {
      key: 'sent',
      label: 'sent',
      at: leftAt,
      count: null,
      done: leftAt != null,
      detail: !o.sentAt && o.emailEventSentAt ? 'email log' : null,
    },
    {
      key: 'delivered',
      label: 'delivered',
      at: o.deliveredAt,
      count: null,
      done: o.deliveredAt != null,
      detail: o.deliveredAt ? deliveredKind(o.deliveredInferred) : null,
    },
    { key: 'opened', label: 'opened', at: o.firstOpenAt, count: o.opens, done: o.opens > 0 },
    {
      key: 'clicked',
      label: 'clicked',
      at: o.firstClickAt,
      count: o.clicks,
      done: o.clicks > 0,
      detail: clickedLine(o.clickedLinks),
    },
    {
      key: 'visited',
      label: 'visited',
      at: o.firstVisitAt,
      count: o.visits,
      done: o.visits > 0,
      detail:
        o.visitedPages.count > 0
          ? `opened ${o.visitedPages.recent.map(pageLabel).join(', ')}`
          : null,
    },
    { key: 'replied', label: 'replied', at: o.repliedAt, count: null, done: o.repliedAt != null },
  ]
}

/**
 * When this document left. The letter-row stamp wins. An email-log send
 * still counts, because a send the row forgot is still a send.
 */
export function cmaOutcomeLeftAt(o: CmaOutcome | null | undefined): string | null {
  if (!o) return null
  return o.sentAt ?? o.emailEventSentAt ?? null
}

/** Done stages, then the first one that has not happened. Undone stages after that stay off the row. */
export function cmaOutcomeProgress(o: CmaOutcome): { done: string[]; next: string | null } {
  const stages = stagesOf(o)
  const done = stages.filter((s) => s.done).map((s) => {
    const times = s.count != null && s.count > 1 ? ` ${s.count}` : ''
    const detail = s.detail && (s.key === 'delivered' || s.key === 'sent') ? ` (${s.detail})` : ''
    return `${s.label}${detail}${times}`
  })
  const next = stages.find((s) => !s.done)
  return { done, next: next ? `not ${next.label}` : null }
}

/** The stamp a broker wants on hover: when, and how many times if more than one. */
function stampFor(s: Stage): string {
  if (!s.done) return `Not ${s.label} yet`
  const when = s.at ? formatDateTime(s.at) : 'time not recorded'
  const times = s.count != null && s.count > 1 ? ` · ${s.count}×` : ''
  const detail = s.detail ? ` · ${s.detail}` : ''
  return `First ${s.label} ${when}${times}${detail}`
}

/** Bounce and unsubscribe are the only things that turn this cell red. */
function exceptionsOf(o: CmaOutcome): string[] {
  const out: string[] = []
  if (o.bounced) out.push('bounced')
  if (o.unsubscribed) out.push('unsubscribed')
  return out
}

export function CmaOutcomeCell({ outcome, variant = 'row' }: CmaOutcomeCellProps) {
  if (!outcome || !cmaOutcomeLeftAt(outcome)) {
    return (
      <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        No send recorded
      </span>
    )
  }

  const stages = stagesOf(outcome)
  const progress = cmaOutcomeProgress(outcome)
  const exceptions = exceptionsOf(outcome)

  if (variant === 'panel') {
    return (
      <div style={{ display: 'grid', gap: 'var(--a-s2)' }}>
        {stages.map((s) => (
          <div
            key={s.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 'var(--a-s3)',
              fontSize: 'var(--a-text-sm)',
              color: s.done ? 'var(--a-text)' : 'var(--a-text-2)',
              borderBottom: '1px solid var(--a-border)',
              paddingBottom: 'var(--a-s2)',
            }}
          >
            <span style={{ textTransform: 'capitalize', color: s.done && s.key === 'replied' ? 'var(--a-ok)' : undefined }}>
              {s.label}
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              {s.done ? (
                <>
                  {s.at ? formatDateTime(s.at) : 'recorded'}
                  {s.count != null && s.count > 1 ? ` · ${s.count}×` : ''}
                </>
              ) : (
                'not yet'
              )}
            </span>
          </div>
        ))}
        {!outcome.sentAt && outcome.emailEventSentAt ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            The email log has a send. This letter row has no send stamp.
          </p>
        ) : null}
        {clickedLine(outcome.clickedLinks) ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            {clickedLine(outcome.clickedLinks)}
          </p>
        ) : null}
        {outcome.visitedPages.count > 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            Opened from the document: {outcome.visitedPages.recent.map(pageLabel).join(' · ')}
          </p>
        ) : null}
        {exceptions.length > 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
            This send {exceptions.join(' and ')}. Nothing more will reach this address until it is
            resolved.
          </p>
        ) : null}
        {outcome.leadStage ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            Contact stage: {outcome.leadStage}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 'var(--a-s1)',
        fontSize: 'var(--a-text-sm)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {stages.filter((s) => s.done).map((s, i) => (
        <span key={s.key}>
          {i > 0 ? <span style={{ color: 'var(--a-border-strong)' }}> · </span> : null}
          <span
            title={stampFor(s)}
            style={{ color: s.key === 'replied' ? 'var(--a-ok)' : 'var(--a-text)' }}
          >
            {progress.done[i]}
          </span>
        </span>
      ))}
      {progress.next ? (
        <span style={{ color: 'var(--a-text-2)' }}>
          {' · '}
          {progress.next}
        </span>
      ) : null}
      {clickedLine(outcome.clickedLinks) ? (
        <span title={clickedLine(outcome.clickedLinks) ?? undefined} style={{ color: 'var(--a-text-2)' }}>
          {' · '}
          {clickedLine(outcome.clickedLinks)}
        </span>
      ) : null}
      {outcome.visitedPages.count > 0 ? (
        <span
          title={`Opened from the document: ${outcome.visitedPages.recent.map(pageLabel).join(' · ')}`}
          style={{ color: 'var(--a-text-2)' }}
        >
          {' · '}
          {pageLabel(outcome.visitedPages.recent[0] ?? '')}
          {outcome.visitedPages.recent.length > 1 ? ` +${outcome.visitedPages.recent.length - 1}` : ''}
        </span>
      ) : null}
      {exceptions.map((e) => (
        <span key={e} style={{ color: 'var(--a-danger)' }}>
          {' · '}
          {e}
        </span>
      ))}
    </span>
  )
}

export default CmaOutcomeCell
