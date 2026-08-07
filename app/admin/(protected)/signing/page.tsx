// @no-parity — internal admin tool (signing dashboard), no public mockup contract
//
// /admin/signing — the envelope dashboard. P11E: migrated to the LOCKED admin
// v2 language (design_system/admin/ADMIN_UI.md) through the family's shared
// presentation kit (@/components/admin/v2). PRESENTATION ONLY.
//
// These are legally binding e-signature envelopes, so nothing that decides
// state was touched. Carried over verbatim: getEnvelopesOverview() and its
// shape, the `counts` reduce keyed on the RAW e.status string, the `active`
// filter (`status === 'sent' || status === 'partially_signed'`), ALL_PREVIEW =
// 8 and the slice(0, 8) / slice(8) split, the four summary statuses and their
// order (sent · partially_signed · completed · draft), every status word from
// ENVELOPE_STATUS_LABEL (not one of them re-worded), `signedCount/recipientCount`,
// the `/admin/signing/${e.id}` and `/admin/deals/${encodeURIComponent(e.dealKey)}`
// hrefs, the `e.dealKey ? e.dealAddress ?? e.dealKey : 'No deal'` fallback
// chain, and `dynamic = 'force-dynamic'`. No envelope status string, signer
// order, token or audit field is read or written here.
//
// DATE FORMATTER — DELIBERATELY NOT SWAPPED. `sentAt.slice(0, 10)` prints the
// UTC calendar day of tc_envelopes.sent_at. formatDate() would re-project that
// instant into America/Los_Angeles, which moves the printed day BACK BY ONE for
// anything sent after 5pm Pacific (e.g. sent_at 2026-08-08T01:30:00Z prints
// "2026-08-08" today and would print "Aug 7, 2026" after a swap). That is a
// changed date on a legal document's record, not a presentation change, so the
// slice stays exactly as it was.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the <h1> is gone (the nav names this page), the four status
// cards became the family's typographic numbers strip carrying the same four
// counts, the status pills became state words carrying the same status text,
// the mobile-card / desktop-table pair became the family's ONE grid (which
// carries its own phone shape), and the shadcn Accordion disclosure became a
// native <details> holding the same "See all N envelopes" split.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getEnvelopesOverview } from '@/app/actions/tc-envelopes'
import { ENVELOPE_STATUS_LABEL, type EnvelopeStatus } from '@/lib/tc/signing'
import {
  ReportGrid,
  ReportNumbers,
  SectionHead,
  StateWord,
  VerdictLine,
  type AdminState,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

/** Same status→severity mapping the pills carried; the word itself is unchanged. */
const STATUS_STATE: Record<EnvelopeStatus, AdminState> = {
  draft: 'waiting',
  sent: 'accent',
  partially_signed: 'slow',
  completed: 'ok',
  voided: 'down',
}

type EnvelopeRow = Awaited<ReturnType<typeof getEnvelopesOverview>>[number]

const COLUMNS: ReportColumn[] = [
  { key: 'envelope', label: 'Envelope' },
  { key: 'deal', label: 'Deal' },
  { key: 'status', label: 'Status' },
  { key: 'signed', label: 'Signed', numeric: true },
  { key: 'sent', label: 'Sent', numeric: true },
]

const TEMPLATE =
  'minmax(180px, 2fr) minmax(150px, 1.6fr) minmax(120px, 1fr) minmax(74px, 0.6fr) minmax(104px, 0.8fr)'

function gridRows(rows: EnvelopeRow[]): ReportGridRow[] {
  return rows.map((e) => ({
    key: e.id,
    cells: [
      <Link key="n" href={`/admin/signing/${e.id}`} style={{ color: 'var(--a-accent)' }}>
        {e.name}
      </Link>,
      e.dealKey ? (
        <Link
          key="d"
          href={`/admin/deals/${encodeURIComponent(e.dealKey)}`}
          style={{ color: 'var(--a-accent)' }}
        >
          {e.dealAddress ?? e.dealKey}
        </Link>
      ) : (
        '—'
      ),
      <StateWord key="s" state={STATUS_STATE[e.status] ?? 'waiting'}>
        {ENVELOPE_STATUS_LABEL[e.status]}
      </StateWord>,
      `${e.signedCount}/${e.recipientCount}`,
      // UTC calendar day of sent_at — see the formatter note in the header.
      e.sentAt ? e.sentAt.slice(0, 10) : '—',
    ],
  }))
}

export default async function SigningDashboard() {
  // CAPABILITY GUARD — see the sibling [envelopeId] page for the full reasoning.
  // Neither page in this family ran any auth of its own.
  await requireAdminPage('transactions.view')

  const envelopes = await getEnvelopesOverview()
  const counts = envelopes.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {})
  const active = envelopes.filter((e) => e.status === 'sent' || e.status === 'partially_signed')
  const ALL_PREVIEW = 8
  const allPreview = envelopes.slice(0, ALL_PREVIEW)
  const allRest = envelopes.slice(ALL_PREVIEW)

  const SUMMARY: EnvelopeStatus[] = ['sent', 'partially_signed', 'completed', 'draft']

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={active.length > 0 ? 'attention' : 'ok'}>
          {envelopes.length === 0 ? (
            <>
              <b>No envelope has been created yet.</b>
            </>
          ) : active.length > 0 ? (
            <>
              <b>
                {active.length.toLocaleString('en-US')}{' '}
                {active.length === 1 ? 'envelope is' : 'envelopes are'} out for signature.
              </b>{' '}
              {(counts.completed ?? 0).toLocaleString('en-US')} completed ·{' '}
              {(counts.draft ?? 0).toLocaleString('en-US')} in draft.
            </>
          ) : (
            <>
              <b>Nothing is out for signature.</b>{' '}
              {(counts.completed ?? 0).toLocaleString('en-US')} completed ·{' '}
              {(counts.draft ?? 0).toLocaleString('en-US')} in draft.
            </>
          )}
        </VerdictLine>
      </div>

      <ReportNumbers
        items={SUMMARY.map((s) => ({
          key: s,
          label: ENVELOPE_STATUS_LABEL[s],
          value: (counts[s] ?? 0).toLocaleString('en-US'),
        }))}
      />

      {active.length ? (
        <>
          <SectionHead>Out for signature</SectionHead>
          <ReportGrid
            label="Envelopes out for signature"
            columns={COLUMNS}
            template={TEMPLATE}
            minWidth={760}
            rows={gridRows(active)}
            empty={null}
          />
        </>
      ) : null}

      <div style={{ marginTop: active.length ? 28 : 0 }}>
        <SectionHead>All envelopes</SectionHead>
        {/* Curate, never dump: most recent few, rest behind a disclosure. */}
        <ReportGrid
          label="All envelopes"
          columns={COLUMNS}
          template={TEMPLATE}
          minWidth={760}
          rows={gridRows(allPreview)}
          empty={
            <>
              No envelopes yet. Open a deal and use &ldquo;New envelope&rdquo; on a document to
              start.
            </>
          }
        />
        {allRest.length > 0 ? (
          <details className="av2-rcols" style={{ marginTop: 12 }}>
            <summary>See all {envelopes.length.toLocaleString('en-US')} envelopes</summary>
            <div style={{ paddingTop: 12 }}>
              <ReportGrid
                label="The rest of the envelopes"
                columns={COLUMNS}
                template={TEMPLATE}
                minWidth={760}
                rows={gridRows(allRest)}
                empty={null}
              />
            </div>
          </details>
        ) : null}
      </div>
    </div>
  )
}
