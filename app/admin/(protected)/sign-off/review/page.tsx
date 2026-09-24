// @no-parity — internal admin tool (principal broker review mode)
//
// Review mode: every document awaiting the principal broker's review, one at a
// time, most urgent first (Matt 2026-09-24: "refer to skyslope for how to
// manage our transactions and then improve on things where they are bad").
//
// Taken from SkySlope's Quick Audit: the document fills the screen, the
// decision sits beside it, and the next item is one step away. Fixed where it
// is weak:
//   - the order is the law's, not the file's: the 7-banking-day clock of
//     OAR 863-015-0140(4) puts the most overdue document first, across every
//     broker's files, instead of one file at a time;
//   - the reader's verdict (which form and release, who signed, who has not,
//     the printed-form check) sits above the PDF, so the review is a check of
//     a claim, not a hunt through pages;
//   - SkySlope opens the PDF in a new browser tab; here it stays in place;
//   - a decision moves straight to the next item instead of back to a list.
// The stamp is the same recordPrincipalReview the queue page uses.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getPrincipalSignOffQueue, getReviewDocuments, type ReviewDocument } from '@/lib/data'
import { readerView } from '@/lib/tc/doc-read/view'
import { documentStateWord } from '@/lib/tc/file-workspace'
import { shortDate } from '@/lib/tc/dashboard'
import { afterDecisionHref, orderReviewQueue, reviewHref, reviewPosition } from '@/lib/tc/review-queue'
import { ReportError, StateWord, VerdictLine } from '@/components/admin/v2'
// The split, checklist and viewer styles live with the workspace primitives;
// this page uses none of those components, so it loads the sheet itself.
import '@/components/admin/v2/workspace.css'
import { DocViewer } from '../../deals/[key]/_parts/DocViewer'
import { ReviewDecision } from './ReviewDecision'

export const dynamic = 'force-dynamic'

const STAGE_LABEL: Record<string, string> = {
  pending: 'Under contract',
  pre_contract: 'Before contract',
  active_listing: 'Active listing',
}

/** The queue rail shows this many; the verdict line always counts all of them. */
const SHOWN = 60

const kb = (n: number | null) => (n == null ? null : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`)

function docMeta(d: ReviewDocument): string {
  return [
    d.pageCount ? `${d.pageCount} page${d.pageCount === 1 ? '' : 's'}` : null,
    kb(d.bytes),
    d.uploadedAt ? `uploaded ${shortDate(d.uploadedAt.slice(0, 10))}, ${d.uploadedAt.slice(0, 4)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export default async function ReviewModePage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; doc?: string; deal?: string }>
}) {
  await requireAdminPage('transactions.signoff')
  const { item, doc, deal } = await searchParams
  const queue = await getPrincipalSignOffQueue().catch(() => null)

  if (queue === null) {
    return (
      <div className="av2-scope av2-wide">
        <VerdictLine tone="attention">
          <b>The review queue could not be read. Nothing below is the queue.</b>
        </VerdictLine>
        <ReportError what="The review queue" href="/admin/sign-off/review" />
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
  const entries = orderReviewQueue(queue.deals, { dealKey })
  const pos = reviewPosition(entries, item)
  const overdue = entries.filter((e) => e.deadline?.overdue).length
  const scopeWord = dealKey ? ' on this file' : ''

  const crumbs = (
    <p style={{ margin: '0 0 var(--a-s2)', fontSize: 'var(--a-text-xs)', display: 'flex', flexWrap: 'wrap', gap: 'var(--a-s3)' }}>
      <Link href="/admin/sign-off" style={{ color: 'var(--a-accent)' }}>
        Sign-off queue
      </Link>
      {dealKey ? (
        <Link href={reviewHref({})} style={{ color: 'var(--a-accent)' }}>
          Review every file
        </Link>
      ) : null}
    </p>
  )

  const cur = pos.current
  if (!cur) {
    return (
      <div className="av2-scope av2-wide">
        {crumbs}
        <VerdictLine tone="ok">
          <b>Nothing is waiting on your review{scopeWord}.</b> Every document a broker submitted has a decision.
        </VerdictLine>
      </div>
    )
  }

  const docs = await getReviewDocuments(cur.docs.map((d) => d.id)).catch(() => null)
  const selected = (docs ?? []).find((d) => d.id === doc) ?? (docs ?? []).find((d) => !d.archived) ?? docs?.[0] ?? null
  const read = selected ? readerView(selected.classification) : null
  const state = selected ? documentStateWord(selected.classification) : null
  const fileHref = `/admin/deals/${encodeURIComponent(cur.propertyKey)}?tab=documents&filter=review`
  const prevHref = pos.prev ? reviewHref({ item: pos.prev.itemId, deal: dealKey }) : null
  const nextHref = pos.next ? reviewHref({ item: pos.next.itemId, deal: dealKey }) : null

  return (
    <div className="av2-scope av2-wide av2-review">
      {crumbs}
      <VerdictLine tone={overdue ? 'attention' : 'ok'}>
        <b>
          {entries.length} document{entries.length === 1 ? '' : 's'} waiting on your review{scopeWord}.
        </b>{' '}
        {overdue ? `${overdue} past the 7-banking-day deadline; the most overdue come first.` : 'None past the 7-banking-day deadline.'}
      </VerdictLine>

      <div className="av2-split" style={{ marginTop: 'var(--a-s4)' }}>
        <nav className="av2-split__rail" aria-label="Review queue">
          <ol className="av2-cl">
            {entries.slice(0, SHOWN).map((e) => (
              <li key={e.itemId} className={`av2-cl__item${e.itemId === cur.itemId ? ' av2-cl__item--current' : ''}`}>
                <Link
                  href={reviewHref({ item: e.itemId, deal: dealKey })}
                  className="av2-review__qlink"
                  aria-current={e.itemId === cur.itemId ? 'true' : undefined}
                  scroll={false}
                >
                  <span className="av2-cl__name">{e.itemName}</span>
                  <span className="av2-review__qaddr">
                    {[e.address.split(',')[0], e.broker, e.deadline ? `due ${shortDate(e.deadline.dueIso)}` : null].filter(Boolean).join(' · ')}
                  </span>
                </Link>
                <StateWord state={e.urgency.tone}>{e.urgency.word}</StateWord>
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
                  {pos.index + 1} of {entries.length}
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
                <div className="av2-review__item">{cur.itemName}</div>
                <Link href={fileHref} className="av2-review__file">
                  {cur.address}
                </Link>
                <div className="av2-viewer__meta" style={{ marginTop: 2 }}>
                  {[cur.broker, STAGE_LABEL[cur.stage] ?? cur.stage, cur.deadline ? `review due ${shortDate(cur.deadline.dueIso)}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="av2-wordrow" style={{ marginTop: 4 }}>
                  <StateWord state={cur.urgency.tone}>
                    {cur.urgency.word} · {cur.urgency.age}
                  </StateWord>
                  {state ? <StateWord state={state.state}>{state.word}</StateWord> : null}
                  {cur.cycleSource === 'skyslope' ? <StateWord state="waiting">From SkySlope</StateWord> : null}
                </div>
              </div>
              {/* keyed by item: a reason typed for one item never carries to the next */}
              <ReviewDecision
                key={cur.itemId}
                itemId={cur.itemId}
                itemName={cur.itemName}
                afterHref={afterDecisionHref(pos, dealKey)}
                prevHref={prevHref}
                nextHref={nextHref}
              />
            </div>

            {docs && docs.length > 1 ? (
              <nav className="av2-review__docs" aria-label="Documents on this item">
                {docs.map((d) => (
                  <Link
                    key={d.id}
                    href={reviewHref({ item: cur.itemId, doc: d.id, deal: dealKey })}
                    className="av2-cl__doc"
                    aria-current={selected?.id === d.id ? 'true' : undefined}
                    scroll={false}
                  >
                    {d.name}
                    {d.archived ? ' (archived)' : ''}
                  </Link>
                ))}
              </nav>
            ) : null}

            {read || cur.cycleSource === 'skyslope' || selected ? (
              <div className="av2-viewer__evidence">
                {selected ? (
                  <p>
                    <b>{selected.name}</b>
                    {docMeta(selected) ? <span style={{ color: 'var(--a-text-2)' }}> · {docMeta(selected)}</span> : null}
                  </p>
                ) : null}
                {read?.forms.map((f, i) => (
                  <p key={`f${i}`}>
                    <b>{f.title}</b>
                    {f.signed.length ? ` · signed: ${f.signed.join(', ')}` : ''}
                    {f.waiting.length ? ` · waiting on: ${f.waiting.join(', ')}` : ''}
                    {f.note ? ` · ${f.note}` : ''}
                  </p>
                ))}
                {read?.checks.map((c, i) => (
                  <p key={`c${i}`} style={{ color: 'var(--a-text-2)' }}>
                    {c}
                  </p>
                ))}
                {selected && !read ? (
                  <p style={{ color: 'var(--a-text-2)' }}>The document reader has not read this copy yet. Check the form and signatures by eye.</p>
                ) : null}
                {cur.cycleSource === 'skyslope' ? (
                  <p style={{ color: 'var(--a-text-2)' }}>
                    This file came from SkySlope, where you review it until the cutover. A decision here is recorded in the Vault with your name
                    and the date, and the daily SkySlope pull will not undo it.
                  </p>
                ) : null}
              </div>
            ) : null}

            {docs === null ? (
              <div className="av2-viewer__empty">The documents on this item could not be read. Open the file to see them.</div>
            ) : !selected ? (
              <div className="av2-viewer__empty">
                No document is attached to this item. Send it back so the broker attaches one, or{' '}
                <Link href={fileHref} style={{ color: 'var(--a-accent)' }}>
                  open the file
                </Link>
                .
              </div>
            ) : selected.hasFile ? (
              <DocViewer documentId={selected.id} name={selected.name} />
            ) : (
              <div className="av2-viewer__empty">This document has no stored file to show.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
