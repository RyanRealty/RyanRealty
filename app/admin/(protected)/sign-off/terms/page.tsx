// @no-parity — internal admin tool (principal broker: contract terms review)
//
// The contract terms that need Matt, one at a time, the page beside the
// decision (Matt 2026-09-24):
//   - "Contract wins, unless a person typed it": a value a broker typed that
//     the executed contract disagrees with waits here for his call;
//   - "Third read breaks the tie ... anything still unsettled goes on the file
//     and into your review queue": a term the readers still read differently
//     after the third read waits here with every reading.
// Only live files: a closed or dead file carries no warnings. Everything else
// the readers agreed on is already on the file. lib/data/tc/deal-terms.ts
// (getTermsReviewQueue) builds the queue; lib/tc/terms/review.ts shapes it.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getTermsReviewQueue } from '@/lib/data'
import { shortDate } from '@/lib/tc/dashboard'
import { afterTermsDecisionHref, termsReviewHref, type TermsReviewItem } from '@/lib/tc/terms/review'
import { ReportError, StateWord, VerdictLine } from '@/components/admin/v2'
// The split and viewer styles live with the workspace primitives; this page
// uses none of those components, so it loads the sheet itself.
import '@/components/admin/v2/workspace.css'
import { DocViewer } from '../../deals/[key]/_parts/DocViewer'
import { TermsDecision } from './TermsDecision'

export const dynamic = 'force-dynamic'

const SHOWN = 60

function railLine(e: TermsReviewItem): string {
  return [e.address.split(',')[0], e.broker, e.closing ? `closes ${shortDate(e.closing)}` : null].filter(Boolean).join(' · ')
}

export default async function TermsReviewPage({ searchParams }: { searchParams: Promise<{ item?: string; deal?: string }> }) {
  await requireAdminPage('transactions.signoff')
  const { item, deal } = await searchParams
  const queue = await getTermsReviewQueue().catch(() => null)

  if (queue === null) {
    return (
      <div className="av2-scope av2-wide">
        <VerdictLine tone="attention">
          <b>The contract terms queue could not be read. Nothing below is the queue.</b>
        </VerdictLine>
        <ReportError what="The contract terms queue" href="/admin/sign-off/terms" />
      </div>
    )
  }
  if (!queue.authorized) {
    return (
      <div className="av2-scope av2-wide">
        <VerdictLine tone="attention">
          <b>This is the principal broker&apos;s review.</b> Your account cannot open it.
        </VerdictLine>
      </div>
    )
  }

  const dealKey = deal?.trim() || null
  const entries = dealKey ? queue.items.filter((e) => e.propertyKey === dealKey) : queue.items
  const index = Math.max(0, entries.findIndex((e) => e.key === item))
  const cur = entries[index] ?? null
  const scopeWord = dealKey ? ' on this file' : ''

  const crumbs = (
    <p style={{ margin: '0 0 var(--a-s2)', fontSize: 'var(--a-text-xs)', display: 'flex', flexWrap: 'wrap', gap: 'var(--a-s3)' }}>
      <Link href="/admin/sign-off" style={{ color: 'var(--a-accent)' }}>
        Sign-off queue
      </Link>
      {dealKey ? (
        <Link href={termsReviewHref({})} style={{ color: 'var(--a-accent)' }}>
          Every file
        </Link>
      ) : null}
    </p>
  )

  if (!cur) {
    return (
      <div className="av2-scope av2-wide">
        {crumbs}
        <VerdictLine tone="ok">
          <b>No contract term is waiting on you{scopeWord}.</b> A term lands here when the contract reader finds a value a broker typed that the
          executed contract disagrees with, or a term the readers still read differently after a third read.
        </VerdictLine>
      </div>
    )
  }

  const prev = entries[index - 1] ?? null
  const next = entries[index + 1] ?? null
  const prevHref = prev ? termsReviewHref({ item: prev.key, deal: dealKey }) : null
  const nextHref = next ? termsReviewHref({ item: next.key, deal: dealKey }) : null
  const fileHref = `/admin/deals/${encodeURIComponent(cur.propertyKey)}`
  const conflicts = entries.filter((e) => e.kind === 'conflict').length
  const doc = cur.kind === 'conflict' ? (cur.source ? { id: cur.source.documentId, name: cur.source.documentName, page: cur.source.page } : null) : { id: cur.documentId, name: cur.documentName, page: cur.page }

  return (
    <div className="av2-scope av2-wide av2-review">
      {crumbs}
      <VerdictLine tone="attention">
        <b>
          {entries.length} contract term{entries.length === 1 ? '' : 's'} waiting on you{scopeWord}.
        </b>{' '}
        {conflicts ? `${conflicts} typed on the file and different from the executed contract; ` : ''}
        {entries.length - conflicts ? `${entries.length - conflicts} read differently by the readers, even after a third read. ` : ''}
        Soonest closing first.
      </VerdictLine>

      <div className="av2-split" style={{ marginTop: 'var(--a-s4)' }}>
        <nav className="av2-split__rail" aria-label="Contract terms queue">
          <ol className="av2-cl">
            {entries.slice(0, SHOWN).map((e) => (
              <li key={e.key} className={`av2-cl__item${e.key === cur.key ? ' av2-cl__item--current' : ''}`}>
                <Link href={termsReviewHref({ item: e.key, deal: dealKey })} className="av2-review__qlink" aria-current={e.key === cur.key ? 'true' : undefined} scroll={false}>
                  <span className="av2-cl__name">{e.label}</span>
                  <span className="av2-review__qaddr">{railLine(e)}</span>
                </Link>
                <StateWord state={e.kind === 'conflict' ? 'slow' : 'waiting'}>{e.kind === 'conflict' ? 'Typed' : 'Split'}</StateWord>
              </li>
            ))}
          </ol>
          {entries.length > SHOWN ? (
            <p className="av2-cl__none" style={{ margin: 'var(--a-s2) 0 0' }}>
              {entries.length - SHOWN} more after these. They move up as you work.
            </p>
          ) : null}
        </nav>

        <div className="av2-split__main">
          <div className="av2-viewer">
            <div className="av2-review__step">
              <span>
                <b style={{ color: 'var(--a-text)' }}>
                  {index + 1} of {entries.length}
                </b>
                <span className="av2-review__keys">
                  {' '}
                  · <span className="av2-kbd">J</span> next · <span className="av2-kbd">K</span> previous
                </span>
              </span>
              <span className="av2-review__steplinks">
                {prevHref ? (
                  <Link href={prevHref} className="av2-review__steplink" scroll={false}>
                    Previous
                  </Link>
                ) : (
                  <span className="av2-review__steplink" aria-disabled="true">
                    Previous
                  </span>
                )}
                {nextHref ? (
                  <Link href={nextHref} className="av2-review__steplink" scroll={false}>
                    Skip to next
                  </Link>
                ) : (
                  <span className="av2-review__steplink" aria-disabled="true">
                    Skip to next
                  </span>
                )}
              </span>
            </div>

            <div className="av2-review__head">
              <div className="av2-review__title">
                <div className="av2-review__item">{cur.label}</div>
                <Link href={fileHref} className="av2-review__file">
                  {cur.address}
                </Link>
                <div className="av2-viewer__meta" style={{ marginTop: 2 }}>
                  {[cur.broker, cur.closing ? `closes ${shortDate(cur.closing)}` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              {/* keyed by item: nothing chosen for one term carries to the next */}
              {cur.kind === 'conflict' ? (
                <TermsDecision
                  key={cur.key}
                  kind="conflict"
                  cycleId={cur.cycleId}
                  column={cur.column}
                  current={cur.current}
                  contract={cur.contract}
                  afterHref={afterTermsDecisionHref(entries, cur.key, dealKey)}
                  prevHref={prevHref}
                  nextHref={nextHref}
                />
              ) : (
                <TermsDecision
                  key={cur.key}
                  kind="unsettled"
                  documentId={cur.documentId}
                  instrument={cur.instrument}
                  field={cur.field}
                  readings={cur.readings}
                  afterHref={afterTermsDecisionHref(entries, cur.key, dealKey)}
                  prevHref={prevHref}
                  nextHref={nextHref}
                />
              )}
            </div>

            <div className="av2-viewer__evidence">
              {cur.kind === 'conflict' ? (
                <>
                  <p>
                    <b>On the file:</b> {cur.current}
                    {cur.typedBy ? ` · typed by ${cur.typedBy}` : ' · typed by a broker'}
                    {cur.typedAt ? ` on ${shortDate(cur.typedAt.slice(0, 10))}` : ''}
                  </p>
                  <p>
                    <b>The executed contract:</b> {cur.contract}
                    {cur.source ? ` · ${[cur.source.instrument, cur.source.page ? `page ${cur.source.page}` : null, cur.source.documentName].filter(Boolean).join(' · ')}` : ''}
                  </p>
                  {cur.source?.quote ? <p style={{ color: 'var(--a-text-2)' }}>&ldquo;{cur.source.quote}&rdquo;</p> : null}
                  <p style={{ color: 'var(--a-text-2)' }}>
                    A value a person typed is never written over by the contract reader. Keeping the file&apos;s value stops this contract value from
                    coming back here; a later contract change would.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <b>{cur.title}</b>
                    {cur.page ? ` · page ${cur.page}` : ''} · {cur.documentName}
                  </p>
                  {cur.readings.map((r) => (
                    <p key={r.display}>
                      <b>{r.display}</b>
                      <span style={{ color: 'var(--a-text-2)' }}>
                        {' '}
                        · read by{' '}
                        {r.readers.map((w) => (w === 'first' ? 'Claude on the PDF' : w === 'second' ? 'Grok on the page image' : 'the third read')).join(' and ')}
                      </span>
                    </p>
                  ))}
                  <p style={{ color: 'var(--a-text-2)' }}>Pick the reading that matches the page. The file&apos;s terms are written again from your pick.</p>
                </>
              )}
            </div>

            {doc ? (
              <DocViewer documentId={doc.id} name={doc.name} page={doc.page} />
            ) : (
              <div className="av2-viewer__empty">
                The contract&apos;s page is not on record for this term.{' '}
                <Link href={fileHref} style={{ color: 'var(--a-accent)' }}>
                  Open the file
                </Link>{' '}
                to see its documents.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
