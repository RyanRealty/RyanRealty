// @no-parity — internal admin surface, no public mockup contract
//
// The recorded-document review queue (PLACE_CONTENT_RULES R7).
//
// WHAT IS BEING DECIDED. Oregon records a declaration once and indexes it by
// party name, document type, date and instrument number — ORS 205.160 gives it
// no subdivision field and no cross-reference from an amendment to what it
// amends. Matching a recorded instrument to a plat is therefore heuristic, and
// a heuristic match sits in place_document_link as pending_review, unreadable
// to the public RLS policy, until a human agrees with it.
//
// WHY THE PAGE IS GROUPED. There are 5,444 pending links over 878 plats. Nobody
// reviews 5,444 rows. One declaration chain governs every phase of a plat, so
// the question is asked once per recorded NAME and answered for every plat at
// once: 353 decisions, biggest first.
//
// WHY THE OCR LINE IS THERE. The document's own front matter is the evidence.
// It is quoted here as an internal machine read for a human to judge, and never
// as page copy — the microfilm-era misreads that keep it off public surfaces are
// exactly why a person is looking at it.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import {
  getPendingPlaceDocuments,
  type PendingPlaceDocumentGroup,
} from '@/lib/data/places/getPendingPlaceDocuments'
import {
  Button,
  HiddenField,
  QueueRow,
  ReportError,
  SectionHead,
  StateWord,
  VerdictLine,
} from '@/components/admin/v2'
import {
  approvePlaceDocumentGroupAction,
  rejectPlaceDocumentGroupAction,
} from './actions'

export const metadata = { title: 'Recorded documents | Admin' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>
}

function firstParam(params: Record<string, string | string[]>, key: string): string {
  const v = params[key]
  if (!v) return ''
  return Array.isArray(v) ? (v[0] ?? '') : v
}

/** The chip word on a document row. Short, because the row carries the rest. */
const SHORT_KIND: Record<string, string> = {
  ccr: 'CC&R',
  amendment: 'Amendment',
  bylaws: 'Bylaws',
  articles: 'Articles',
  design_guidelines: 'Guidelines',
  rules: 'Rules',
  budget: 'Budget',
  reserve_study: 'Reserve study',
  deed: 'Deed',
  easement: 'Easement',
  lien: 'Lien',
  trust_deed: 'Trust deed',
  assignment: 'Assignment',
  contract: 'Contract',
  other: 'Unclassified',
}

const PLAT_CAP = 12

const CARD: React.CSSProperties = {
  borderTop: '1px solid var(--a-border)',
  paddingTop: 14,
  marginBottom: 26,
}
const META: React.CSSProperties = {
  fontSize: 'var(--a-text-sm)',
  color: 'var(--a-text-2)',
  margin: '0 0 6px',
}
const SLUGS: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  fontSize: 'var(--a-text-sm)',
  margin: '0 0 10px',
}
const QUOTE: React.CSSProperties = {
  display: 'block',
  marginTop: 4,
  paddingLeft: 10,
  borderLeft: '2px solid var(--a-border)',
  color: 'var(--a-text-2)',
  fontSize: 'var(--a-text-sm)',
  overflowWrap: 'anywhere',
}
const ROWMETA: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
}
const ACTS: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 }
const PAGER: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'baseline',
  fontSize: 'var(--a-text-sm)',
  color: 'var(--a-text-2)',
  borderTop: '1px solid var(--a-border)',
  paddingTop: 12,
}
const LINK: React.CSSProperties = { color: 'var(--a-accent)' }

function GroupBlock({ group, page }: { group: PendingPlaceDocumentGroup; page: number }) {
  const shown = group.platSlugs.slice(0, PLAT_CAP)
  const hidden = group.platSlugs.length - shown.length
  return (
    <section style={CARD}>
      <SectionHead flush>{group.publishedName}</SectionHead>

      <p style={META}>
        {group.platCount} plat{group.platCount === 1 ? '' : 's'} · {group.documents.length} document
        {group.documents.length === 1 ? '' : 's'} · {group.pendingLinkCount} link
        {group.pendingLinkCount === 1 ? '' : 's'} waiting
        {group.blockedLinkCount > 0
          ? ` · ${group.blockedLinkCount} cannot publish`
          : ''}
      </p>

      <p style={SLUGS}>
        {shown.map((slug) => (
          <Link key={slug} href={`/subdivisions/${slug}`} style={LINK}>
            {slug}
          </Link>
        ))}
        {hidden > 0 ? <span style={{ color: 'var(--a-text-2)' }}>and {hidden} more</span> : null}
      </p>

      <ul className="av2-queue">
        {group.documents.map((doc) => (
          <QueueRow
            key={doc.id}
            kind={SHORT_KIND[doc.kind] ?? 'Unclassified'}
            kindTone={doc.governing ? 'accent' : 'down'}
            title={`${doc.kindLabel}, ${doc.recordingLabel}`}
            context={
              <>
                <span style={ROWMETA}>
                  {doc.governing ? null : (
                    <StateWord state="down">Cannot publish — not a governing instrument</StateWord>
                  )}
                  {doc.nameConfirmed === true ? (
                    <StateWord state="ok">Its text names this subdivision</StateWord>
                  ) : (
                    <StateWord state="waiting">Its text never names this subdivision</StateWord>
                  )}
                  <span>
                    {doc.pageCount ?? '?'} pages · {doc.county} County · {doc.pendingLinkCount} plat
                    {doc.pendingLinkCount === 1 ? '' : 's'}
                  </span>
                </span>
                {doc.ocrExcerpt ? (
                  <span style={QUOTE}>{doc.ocrExcerpt}</span>
                ) : (
                  <span style={QUOTE}>No text was read from this scan.</span>
                )}
              </>
            }
            action={
              doc.url ? (
                <a href={doc.url} target="_blank" rel="noreferrer" style={LINK}>
                  Open PDF
                </a>
              ) : null
            }
          />
        ))}
      </ul>

      <div style={ACTS}>
        {group.approvableLinkCount > 0 ? (
          <form action={approvePlaceDocumentGroupAction}>
            <HiddenField name="publishedName" value={group.publishedName} />
            <HiddenField name="page" value={page} />
            <Button type="submit" touch>
              Approve {group.approvableLinkCount} link
              {group.approvableLinkCount === 1 ? '' : 's'}
            </Button>
          </form>
        ) : null}
        <form action={rejectPlaceDocumentGroupAction}>
          <HiddenField name="publishedName" value={group.publishedName} />
          <HiddenField name="page" value={page} />
          <Button type="submit" variant="danger" touch>
            Reject all {group.pendingLinkCount}
          </Button>
        </form>
      </div>
    </section>
  )
}

export default async function PlaceDocumentsReviewPage({ searchParams }: PageProps) {
  // Publishing a recorded instrument onto a subdivision page is a broker call,
  // and content.communities is superuser-only. The nav hides this; the page
  // enforces it, because a hand-typed URL never passes through the nav.
  await requireAdminPage('content.communities')

  const params = await searchParams
  const requested = Number.parseInt(firstParam(params, 'page'), 10)
  const done = firstParam(params, 'done')
  const err = firstParam(params, 'err')

  const queue = await getPendingPlaceDocuments({
    page: Number.isFinite(requested) && requested > 0 ? requested : 1,
  }).catch((e: unknown) => {
    console.error('[place-documents] queue read failed:', e)
    return null
  })

  const failed = queue === null
  const groups = queue?.groups ?? []

  return (
    <div className="av2-scope" style={{ maxWidth: 1040, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={failed || (queue?.totalPendingLinks ?? 0) > 0 ? 'attention' : 'ok'}>
          {failed ? (
            <b>The review queue could not be read. Nothing below is the queue.</b>
          ) : queue.totalPendingLinks === 0 ? (
            <b>No recorded document is waiting for review.</b>
          ) : (
            <>
              <b>
                {queue.totalGroups} recorded name
                {queue.totalGroups === 1 ? '' : 's'} waiting on you.
              </b>{' '}
              They carry {queue.totalPendingLinks} unreviewed links across {queue.totalPlats} plats.
              Approving a name settles every plat under it at once.
            </>
          )}
        </VerdictLine>
      </div>

      {failed ? <ReportError what="The recorded-document queue" href="/admin/place-documents" /> : null}

      {err ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)', margin: '0 0 12px' }}>
          {err}
        </p>
      ) : null}
      {done ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-ok)', margin: '0 0 12px' }}>
          {done}
        </p>
      ) : null}

      {!failed && queue.totalPendingLinks > 0 ? (
        <p style={META}>
          Approve publishes the governing instruments under a name — declarations, amendments,
          bylaws, articles, design guidelines, rules. Deeds, easements, liens and trust deeds share
          the same source bucket and can never publish, whoever approves them; reject is their only
          exit. {queue.groupsWithNothingToPublish} name
          {queue.groupsWithNothingToPublish === 1 ? '' : 's'} hold nothing publishable at all.
        </p>
      ) : null}

      {groups.length === 0 ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', padding: '24px 0' }}>
          {failed
            ? 'The read failed, so this queue is unknown — not empty.'
            : 'Every heuristic match has been reviewed.'}
        </p>
      ) : (
        groups.map((group) => (
          <GroupBlock key={group.publishedName} group={group} page={queue?.page ?? 1} />
        ))
      )}

      {!failed && queue.pageCount > 1 ? (
        <div style={PAGER}>
          {queue.page > 1 ? (
            <Link href={`/admin/place-documents?page=${queue.page - 1}`} style={LINK}>
              Previous
            </Link>
          ) : null}
          <span>
            Page {queue.page} of {queue.pageCount} · {queue.pageSize} names at a time
          </span>
          {queue.page < queue.pageCount ? (
            <Link href={`/admin/place-documents?page=${queue.page + 1}`} style={LINK}>
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
