// @no-parity — internal admin tool (deal detail: documents, archive, checklist, audit)
//
// 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
// ENTITY page (pattern 5: identity header + stacked context sections).
// Presentation only.
//
// THE FORMATTERS STAY. `money`, `d10` and `kb` are NOT routed through lib/format.
// formatPrice rounds to the nearest $1,000 — a sale price of $894,750 prints as
// $895,000, which on a settlement figure is a wrong number. formatPriceExact
// agrees with `money` on positives and null but flips the sign placement on
// negatives and breaks .5 the other way. `d10` slices the first ten characters
// of the stored date; formatDate parses a date-only string as UTC and
// re-projects it to America/Los_Angeles, moving a printed closing day BACK BY
// ONE. All three are §0 figure changes, not presentation changes.
//
// Carried over verbatim: `params` / `searchParams` as Promises and both awaits,
// `archived === '1'`, getTcDeal(decodeURIComponent(key)) and its notFound(),
// getDealContacts, getCommissionsForCycles over every cycle id,
// getAnticipatedDocuments per cycle, getEnvelopesForCycle and the envelope-cycle
// labels, the archived-document filter, the first-cycle-open default, every
// commission expression (gross, the referral + tc + other fee sum, agent net and
// its split percent, brokerage net, paid date, the two-decimal commission
// percent), every cycle fact (sale price, office gross, escrow number, MLS
// number, closing/dead dates, sellers, buyers), the anticipated-document
// predictor's counts and citations, the checklist and its document links, the
// audit trail's 16-character timestamp slice and 120-character detail slice, and
// both ?archived= hrefs.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the address moved from a raw <h1> into EntityTitle, the shadcn
// Accordion became a native <details> disclosure with the same first-cycle-open
// default and the same summary text, the shadcn document table plus its phone
// card deck became one ReportGrid that scrolls inside its own box, and every
// Badge became a v2 state word. The archived row's 60% opacity is gone — the
// "Archived" state word carries that meaning in text, which is the rule the
// opacity was standing in for. The hover preview moved to ./DocumentName
// unchanged; the commission, upload, archive, download and checklist editors are
// mounted unchanged.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import {
  EntityTitle,
  ReportGrid,
  SectionHead,
  StateWord,
  type ReportGridRow,
} from '@/components/admin/v2'
import { getTcDeal, type TcCycle } from '@/app/actions/tc'
import { getAnticipatedDocuments, type AnticipatedDocsResult } from '@/app/actions/tc-required-docs'
import { getDealContacts } from '@/app/actions/tc-contacts'
import { getCommissionsForCycles, type TcCommission } from '@/app/actions/tc-commissions'
import { ArchiveToggle, DownloadButton } from './DocumentRowActions'
import { DocumentUpload } from './DocumentUpload'
import { CommissionEdit } from './CommissionControls'
import { ChecklistStatusControl } from './ChecklistControls'
import { DealContacts } from './DealContacts'
import { DealEnvelopes } from './DealEnvelopes'
import { DealOffers } from './DealOffers'
import { FillOrefPacket } from './FillOrefPacket'
import { DocumentName } from './DocumentName'
import { getEnvelopesForCycle } from '@/app/actions/tc-envelopes'
import { listDealOffers, listEnvelopeTemplates } from '@/lib/data'
import { getPreferredOrefSaleAgreement, type PreferredOrefForm } from '@/lib/data'
import { getDealParties } from '@/lib/data/tc/deal-people'
import { DealParties } from './DealParties'
import { DealStageControls } from './DealStageControls'
import { ListingFileActions } from './ListingFileActions'
import { getLiveDealCycles } from '@/lib/data/tc/closings'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { tcEventDetailPreview, tcEventLabel } from '@/lib/tc/events'
import {
  COMMISSION_STATUS,
  DOC_COLUMNS,
  DOC_MIN_WIDTH,
  DOC_TEMPLATE,
  ROLE_LABEL,
  SIDE_LABEL,
  STAGE_LABEL,
} from './_columns'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ key: string }>
  searchParams: Promise<{ archived?: string }>
}

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`
const d10 = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '—')
const kb = (n: number | null | undefined) =>
  n == null ? '—' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`

const quiet = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' } as const
const tiny = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' } as const

/** Commission block per sale cycle (rung 11). Every figure expression here is
 *  carried from the pre-11D markup character for character. */
function CommissionSection({ rows }: { rows: TcCommission[] }) {
  if (!rows.length) return null
  return (
    <section aria-label="Commission">
      <SectionHead>Commission</SectionHead>
      {rows.map((r) => {
        const st = COMMISSION_STATUS[r.status] ?? COMMISSION_STATUS.projected
        const fees = r.referral_fee + r.tc_fee + r.other_deductions
        return (
          <div
            key={r.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 2px',
              borderBottom: '1px solid var(--a-border)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--a-text-md)' }}>
                {r.broker_name}
                <span style={{ ...tiny, marginLeft: 8 }}>{SIDE_LABEL[r.side]}</span>
                {r.commission_percent != null ? (
                  <span style={{ ...tiny, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
                    {Number(r.commission_percent.toFixed(2))}%
                  </span>
                ) : null}
              </p>
              <p style={{ ...tiny, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                Gross {money(r.gci)}
                {fees > 0 ? <> · fees {money(fees)}</> : null}
                {' · '}agent {money(r.agent_net)} ({Number(r.split_percent)}%)
                {' · '}brokerage {money(r.brokerage_net)}
                {r.paid_at ? <> · paid {d10(r.paid_at)}</> : null}
              </p>
              {r.notes ? <p style={{ ...tiny, margin: '2px 0 0' }}>{r.notes}</p> : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StateWord state={st.state}>{st.label}</StateWord>
              <CommissionEdit row={r} />
            </div>
          </div>
        )
      })}
    </section>
  )
}

/** Anticipated-documents view — the Oregon-law required-doc predictor. */
function AnticipatedDocs({ data }: { data: AnticipatedDocsResult | null }) {
  if (!data || data.documents.length === 0) return null
  const missing = data.documents.filter((d) => !d.present)
  return (
    <section aria-label="Documents anticipated">
      <SectionHead>Documents anticipated · {ROLE_LABEL[data.role] ?? data.role}</SectionHead>
      <p style={{ ...tiny, margin: '0 0 8px', fontVariantNumeric: 'tabular-nums' }}>
        {data.documents.filter((d) => d.present).length}/{data.documents.length} present
        {data.missingRequired > 0 ? ` · ${data.missingRequired} required missing` : ''}
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {data.documents.slice(0, 12).map((d) => (
          <li
            key={d.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: 8,
              padding: '6px 2px',
              borderBottom: '1px solid var(--a-border)',
              fontSize: 'var(--a-text-sm)',
            }}
          >
            <StateWord state={d.present ? 'ok' : d.severity === 'required' ? 'down' : 'slow'}>
              {d.present ? 'On file' : d.severity === 'required' ? 'Required' : 'Expected'}
            </StateWord>
            <span
              style={{
                color: d.present ? 'var(--a-text-2)' : 'var(--a-text)',
                textDecoration: d.present ? 'line-through' : undefined,
              }}
            >
              {d.label}
            </span>
            {d.orefForm ? <span style={tiny}>OREF {d.orefForm}</span> : null}
            <span style={tiny} title={d.citation}>
              {d.severity === 'verify' ? '⚑ verify · ' : ''}
              {d.citation}
            </span>
          </li>
        ))}
      </ul>
      {data.documents.length > 12 ? (
        <p style={{ ...tiny, margin: '8px 0 0', fontWeight: 500 }}>
          Showing 12 of {data.documents.length}
        </p>
      ) : null}
      {missing.length > 0 ? (
        <p style={{ ...tiny, margin: '8px 0 0' }}>
          {missing.length} not yet on file.{' '}
          {data.unknown.length > 0
            ? `Confirm to refine: ${data.unknown.slice(0, 4).join(', ')}${data.unknown.length > 4 ? '…' : ''}`
            : ''}
        </p>
      ) : null}
    </section>
  )
}

function CycleSection({
  cycle,
  showArchived,
  anticipated,
  commissions,
  orefForm,
}: {
  cycle: TcCycle
  showArchived: boolean
  anticipated: AnticipatedDocsResult | null
  commissions: TcCommission[]
  orefForm: PreferredOrefForm | null
}) {
  const docs = cycle.documents.filter((doc) => (showArchived ? true : !doc.archived))
  const archivedCount = cycle.documents.filter((doc) => doc.archived).length
  const docNameById = new Map(cycle.documents.map((doc) => [doc.id, doc.name]))
  const assignedIds = new Set(cycle.checklist.flatMap((it) => it.documentIds))
  const unfiled = docs.filter((doc) => !doc.archived && !assignedIds.has(doc.id))

  const docRows: ReportGridRow[] = docs.map((doc) => ({
    key: doc.id,
    cells: [
      <span key="n" style={{ display: 'block', minWidth: 0 }}>
        <DocumentName doc={doc} />
        {doc.archived && doc.archived_reason ? (
          <span style={{ ...tiny, display: 'block' }} title={doc.archived_reason}>
            {doc.archived_reason}
          </span>
        ) : null}
      </span>,
      doc.page_count ?? '—',
      kb(doc.bytes),
      d10(doc.source_uploaded_at),
      <span key="s" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
        {doc.is_broker_notes ? <StateWord state="accent">Broker notes</StateWord> : null}
        {doc.archived ? (
          <StateWord state="waiting">Archived</StateWord>
        ) : (
          <StateWord state="ok">Live</StateWord>
        )}
      </span>,
      <span key="a" style={{ display: 'inline-flex', gap: 8 }}>
        <DownloadButton documentId={doc.id} disabled={!doc.storage_path} />
        <ArchiveToggle documentId={doc.id} archived={doc.archived} docName={doc.name} />
      </span>,
    ],
  }))

  return (
    <>
      <p
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 20px',
          margin: '12px 0 0',
          fontSize: 'var(--a-text-sm)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {cycle.sale_price ? <span>{money(cycle.sale_price)}</span> : null}
        {cycle.office_gross ? <span style={quiet}>gross {money(cycle.office_gross)}</span> : null}
        {cycle.escrow_number ? <span style={quiet}>escrow {cycle.escrow_number}</span> : null}
        {cycle.mls_number ? <span style={quiet}>MLS {cycle.mls_number}</span> : null}
        {cycle.actual_closing_date ? (
          <span style={quiet}>closed {d10(cycle.actual_closing_date)}</span>
        ) : cycle.escrow_closing_date ? (
          <span style={quiet}>closes {d10(cycle.escrow_closing_date)}</span>
        ) : null}
        {cycle.dead_date ? <span style={quiet}>dead {d10(cycle.dead_date)}</span> : null}
      </p>
      {cycle.sellers.length || cycle.buyers.length ? (
        <p style={{ ...tiny, margin: '4px 0 0' }}>
          {cycle.sellers.length ? `Sellers: ${cycle.sellers.join(', ')}` : ''}
          {cycle.sellers.length && cycle.buyers.length ? ' · ' : ''}
          {cycle.buyers.length ? `Buyers: ${cycle.buyers.join(', ')}` : ''}
        </p>
      ) : null}

      <AnticipatedDocs data={anticipated} />
      <FillOrefPacket cycleId={cycle.id} form={orefForm} />
      <CommissionSection rows={commissions} />

      <section aria-label="Documents">
        <SectionHead>
          Documents ({docs.length}
          {!showArchived && archivedCount ? ` live · ${archivedCount} archived hidden` : ''})
        </SectionHead>
        <div style={{ margin: '0 0 8px' }}>
          <DocumentUpload
            cycleId={cycle.id}
            checklistItems={cycle.checklist.map((it) => ({ id: it.id, name: it.name }))}
          />
        </div>
        <ReportGrid
          label="Cycle documents"
          columns={DOC_COLUMNS}
          template={DOC_TEMPLATE}
          minWidth={DOC_MIN_WIDTH}
          rows={docRows}
          empty={
            <>
              No document on this cycle{!showArchived && archivedCount
                ? ` — ${archivedCount} archived one${archivedCount === 1 ? ' is' : 's are'} hidden. Use "Show archived" above.`
                : '. Upload one above.'}
            </>
          }
        />
      </section>

      <section aria-label="Checklist">
        <SectionHead>Checklist</SectionHead>
        {cycle.checklist.length === 0 ? (
          <p style={{ ...quiet, margin: 0 }}>No checklist item on this cycle.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {cycle.checklist.map((item) => (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 2px',
                  borderBottom: '1px solid var(--a-border)',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--a-text-sm)' }}>{item.name}</span>
                  {item.documentIds.length ? (
                    <span style={{ ...tiny, display: 'block' }}>
                      {item.documentIds
                        .map((id) => docNameById.get(id))
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  ) : null}
                </span>
                <ChecklistStatusControl
                  itemId={item.id}
                  status={item.status}
                  docCount={item.documentIds.length}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {unfiled.length > 0 ? (
        <section aria-label="Working documents">
          <SectionHead>Working documents ({unfiled.length})</SectionHead>
          <p style={{ ...tiny, margin: '0 0 8px' }}>
            On the cycle, not assigned to a checklist row yet.
          </p>
          <ul className="av2-quietlist">
            {unfiled.map((doc) => (
              <li key={doc.id} className="av2-quiet">
                <span className="av2-quiet__name">{doc.name}</span>
                <span className="av2-quiet__fig">{d10(doc.source_uploaded_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

export default async function TcDealPage({ params, searchParams }: Props) {
  // CAPABILITY GUARD. This page ran no auth of its own — only the (protected)
  // layout's "signed in with SOME admin role" check — while its own list page,
  // /admin/closings, guards on requireAdminPage('transactions.view'). A detail
  // page that skips the capability its list enforces is reachable by direct URL
  // with a role the list bounces, and this one renders commissions, GCI, splits,
  // settlement figures and every transaction document.
  //
  // Brokers are scoped to their files (dealVisibleToBroker in getTcDeal).
  // Superuser sees all. transactions.view still excludes report_viewer.
  const ctx = await requireAdminPage('transactions.view')

  const { key } = await params
  const { archived } = await searchParams
  const showArchived = archived === '1'
  const deal = await getTcDeal(decodeURIComponent(key))
  if (!deal) notFound()

  const [contacts, commissions, orefFormResult, parties, liveCycles, offers] = await Promise.all([
    getDealContacts(deal.id),
    getCommissionsForCycles(deal.cycles.map((c) => c.id)),
    getPreferredOrefSaleAgreement(),
    getDealParties(deal.id),
    getLiveDealCycles(),
    listDealOffers(deal.id),
  ])
  const mergeOthers = liveCycles.filter(
    (d) =>
      d.propertyKey !== deal.property_key &&
      d.stage === 'active_listing' &&
      dealVisibleToBroker({
        role: ctx.role,
        brokerSlug: ctx.brokerSlug,
        dealBrokerName: d.brokerName,
      }),
  )
  const orefForm = orefFormResult.data

  const anticipatedByCycle = new Map<string, AnticipatedDocsResult | null>(
    await Promise.all(
      deal.cycles.map(
        async (c) => [c.id, await getAnticipatedDocuments(c.id)] as [string, AnticipatedDocsResult | null]
      )
    )
  )

  const [envelopeCycles, envelopeTemplates] = await Promise.all([
    Promise.all(
      deal.cycles.map(async (c) => ({
        cycleId: c.id,
        label: c.kind === 'listing' ? 'Listing folder' : `Sale cycle${c.status ? ` · ${c.status}` : ''}`,
        documents: c.documents.filter((doc) => !doc.archived).map((doc) => ({ id: doc.id, name: doc.name })),
        envelopes: await getEnvelopesForCycle(c.id),
      })),
    ),
    listEnvelopeTemplates(),
  ])

  return (
    <div className="av2-scope" style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <nav aria-label="Breadcrumb" style={{ ...tiny, margin: '0 0 8px' }}>
        <Link href="/admin/closings" style={{ color: 'var(--a-accent)' }}>
          Closings
        </Link>
      </nav>

      <EntityTitle>{deal.address}</EntityTitle>

      <div className="av2-wordrow" style={{ margin: '6px 0 0' }}>
        <StateWord state={deal.stage === 'dead' ? 'down' : deal.stage === 'closed' ? 'ok' : 'accent'}>
          {STAGE_LABEL[deal.stage] ?? deal.stage}
        </StateWord>
        <span style={quiet}>
          {deal.broker_name ?? '—'} · {deal.stage_detail ?? STAGE_LABEL[deal.stage] ?? deal.stage}
        </span>
        <Link
          href={
            showArchived
              ? `/admin/deals/${encodeURIComponent(deal.property_key)}`
              : `/admin/deals/${encodeURIComponent(deal.property_key)}?archived=1`
          }
          style={{ ...tiny, color: 'var(--a-accent)' }}
        >
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Link>
        <DealStageControls
          propertyKey={deal.property_key}
          stage={deal.stage}
          brokerName={deal.broker_name}
          canAssign={ctx.role === 'superuser'}
        />
        <ListingFileActions
          propertyKey={deal.property_key}
          stage={deal.stage}
          others={mergeOthers}
        />
      </div>
      {(() => {
        const datesCycle =
          (deal.stage === 'active_listing'
            ? [...deal.cycles].reverse().find((c) => c.kind === 'listing')
            : [...deal.cycles].reverse().find((c) => c.kind === 'sale')) ?? deal.cycles[0]
        if (!datesCycle) return null
        const bits = [
          datesCycle.mls_number ? `MLS ${datesCycle.mls_number}` : null,
          datesCycle.escrow_number ? `Escrow ${datesCycle.escrow_number}` : null,
          datesCycle.expiration_date ? `Expires ${d10(datesCycle.expiration_date)}` : null,
          datesCycle.contract_acceptance_date ? `Accepted ${d10(datesCycle.contract_acceptance_date)}` : null,
          datesCycle.escrow_closing_date ? `Closes ${d10(datesCycle.escrow_closing_date)}` : null,
        ].filter(Boolean)
        if (!bits.length) return null
        return (
          <p style={{ ...quiet, margin: '8px 0 0' }}>{bits.join(' · ')}</p>
        )
      })()}

      {deal.cycles.length === 0 ? (
        <p style={{ ...quiet, marginTop: 20 }}>
          This deal has no cycle. Documents, commission and the checklist all hang off a cycle, so
          there is nothing to show until one syncs.
        </p>
      ) : null}

      {deal.cycles.map((cycle, i) => (
        <details key={cycle.id} className="av2-rcols" open={i === 0} style={{ marginTop: 16 }}>
          <summary>
            {cycle.kind === 'listing' ? 'Listing folder' : 'Sale cycle'} · {cycle.status ?? '—'} ·{' '}
            {cycle.documents.filter((doc) => !doc.archived).length} live docs ·{' '}
            {cycle.source_guid.slice(0, 8)}
          </summary>
          <div>
            <CycleSection
              cycle={cycle}
              showArchived={showArchived}
              anticipated={anticipatedByCycle.get(cycle.id) ?? null}
              commissions={commissions.filter((r) => r.cycle_id === cycle.id)}
              orefForm={orefForm}
            />
          </div>
        </details>
      ))}

      <DealOffers dealId={deal.id} stage={deal.stage} offers={offers} />

      <DealParties dealId={deal.id} propertyKey={deal.property_key} parties={parties} />

      {/* Deal team & contacts (co-agents + lender/title/escrow/appraiser/TC) */}
      <DealContacts dealId={deal.id} contacts={contacts} />

      {/* Envelopes & signing (Phase 2b) */}
      <DealEnvelopes cycles={envelopeCycles} templates={envelopeTemplates} />

      <section aria-label="Recent activity">
        <SectionHead>Recent activity</SectionHead>
        {deal.events.length === 0 ? (
          <p style={{ ...tiny, margin: 0 }}>No events yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {deal.events.map((e) => {
              const preview = tcEventDetailPreview(e.detail)
              return (
              <li
                key={e.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  padding: '6px 2px',
                  borderBottom: '1px solid var(--a-border)',
                  ...tiny,
                }}
              >
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {String(e.created_at).slice(0, 16).replace('T', ' ')}
                </span>
                <span style={{ fontWeight: 500, color: 'var(--a-text)' }}>{tcEventLabel(e.action)}</span>
                <span>{e.actor}</span>
                {preview ? (
                  <span style={{ overflowWrap: 'anywhere' }}>{preview}</span>
                ) : null}
              </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
