// @no-parity — internal admin surface, no public mockup contract
// All files — every transaction file in one table, filtered by ONE control
// (the view dropdown) plus search. The dashboard at /admin/closings shows only
// what is live and what needs a person; closed and dead history lives here so
// neither page turns back into a long scrolling list (Matt 2026-09-24).
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { closingMatchesQuery, getClosingsBoard, type ClosingDealRow } from '@/lib/data/tc/closings'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { exactMoney, isTestFile, shortDate } from '@/lib/tc/dashboard'
import {
  Button,
  HiddenField,
  Meter,
  ReportGrid,
  StateWord,
  TextField,
  ToolbarSelect,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

const VIEWS = {
  live: { label: 'Live files', stages: ['pre_contract', 'active_listing', 'pending'] },
  closed: { label: 'Closed', stages: ['closed'] },
  dead: { label: 'Canceled and expired', stages: ['dead'] },
  all: { label: 'Every file', stages: ['pre_contract', 'active_listing', 'pending', 'closed', 'dead'] },
} as const
type ViewKey = keyof typeof VIEWS

const STAGE: Record<string, { word: string; state: 'accent' | 'ok' | 'down' | 'waiting' }> = {
  pre_contract: { word: 'Before contract', state: 'waiting' },
  active_listing: { word: 'Active listing', state: 'accent' },
  pending: { word: 'Under contract', state: 'accent' },
  closed: { word: 'Closed', state: 'ok' },
  dead: { word: 'Dead', state: 'down' },
}

const COLUMNS: ReportColumn[] = [
  { key: 'file', label: 'File' },
  { key: 'stage', label: 'Stage' },
  { key: 'broker', label: 'Broker' },
  { key: 'price', label: 'Price', numeric: true },
  { key: 'date', label: 'Key date' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'open', label: 'Open items' },
]

function keyDate(d: ClosingDealRow): { sort: string; label: string } {
  if (d.stage === 'closed') {
    const c = d.actualClosingDate ?? d.escrowClosingDate
    return { sort: c ?? '', label: c ? `Closed ${shortDate(c)}, ${c.slice(0, 4)}` : 'Closed' }
  }
  if (d.stage === 'pending') return { sort: d.escrowClosingDate ?? '', label: d.escrowClosingDate ? `Closes ${shortDate(d.escrowClosingDate)}` : 'No close date' }
  if (d.stage === 'active_listing') return { sort: d.expirationDate ?? '', label: d.expirationDate ? `Expires ${shortDate(d.expirationDate)}` : 'No expiration' }
  return { sort: '', label: d.stageDetail ?? '' }
}

export default async function AllFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; mine?: string }>
}) {
  const ctx = await requireAdminPage('transactions.view')
  const { q, view: viewParam, mine } = await searchParams
  const view: ViewKey = viewParam && viewParam in VIEWS ? (viewParam as ViewKey) : 'all'
  const mineOnly = ctx.role === 'superuser' && mine === '1'
  const board = await getClosingsBoard()
  const query = q?.trim() ?? ''
  const stages = new Set<string>(VIEWS[view].stages)
  const rows = board.deals
    .filter((d) => dealVisibleToBroker({ role: mineOnly ? 'broker' : ctx.role, brokerSlug: ctx.brokerSlug, dealBrokerName: d.brokerName }))
    .filter((d) => stages.has(d.stage) && !isTestFile(d))
    .filter((d) => (query ? closingMatchesQuery(d, query) : true))
    .sort((a, b) => {
      const order = ['pending', 'pre_contract', 'active_listing', 'closed', 'dead']
      const s = order.indexOf(a.stage) - order.indexOf(b.stage)
      if (s) return s
      const da = keyDate(a).sort
      const db = keyDate(b).sort
      return a.stage === 'closed' || a.stage === 'dead' ? db.localeCompare(da) : da.localeCompare(db)
    })

  const gridRows: ReportGridRow[] = rows.map((d) => {
    const st = STAGE[d.stage] ?? { word: d.stage, state: 'waiting' as const }
    const done = d.itemsTotal - d.itemsRequired - d.itemsInReview
    const price = d.stage === 'active_listing' ? d.listingPrice : d.salePrice ?? d.listingPrice
    return {
      key: d.id,
      cells: [
        <span key="f" style={{ display: 'block', minWidth: 0 }}>
          <Link href={`/admin/deals/${encodeURIComponent(d.propertyKey)}`} style={{ color: 'var(--a-accent)', fontWeight: 500 }}>
            {d.address.split(',')[0]}
          </Link>
          <span style={{ display: 'block', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            {[d.city, d.partyNames.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
          </span>
        </span>,
        <StateWord key="s" state={st.state}>
          {st.word}
        </StateWord>,
        d.brokerName ?? '—',
        price != null ? exactMoney(price) : '—',
        keyDate(d).label || '—',
        d.itemsTotal ? <Meter key="m" done={done} total={d.itemsTotal} /> : '—',
        <span key="o" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
          {d.itemsInReview ? <StateWord state="slow">{d.itemsInReview} in review</StateWord> : null}
          {d.itemsRequired ? <StateWord state="waiting">{d.itemsRequired} missing</StateWord> : null}
          {!d.itemsInReview && !d.itemsRequired ? <span style={{ color: 'var(--a-text-2)' }}>none</span> : null}
        </span>,
      ],
    }
  })

  return (
    <div className="av2-scope av2-wide">
      <p style={{ margin: '0 0 var(--a-s2)', fontSize: 'var(--a-text-xs)' }}>
        <Link href="/admin/closings" style={{ color: 'var(--a-accent)' }}>
          Dashboard
        </Link>
      </p>
      {board.unreadable ? (
        <VerdictLine tone="attention">
          <b>The deal store is unreadable right now.</b> Do not assume this list is complete.
        </VerdictLine>
      ) : (
        <VerdictLine tone="ok">
          <b>
            {rows.length} {VIEWS[view].label.toLowerCase()}
          </b>
          {query ? ` matching “${query}”` : ''}
          {mineOnly ? ' · yours' : ''}
        </VerdictLine>
      )}
      <form method="GET" className="av2-rfilters" style={{ margin: 'var(--a-s4) 0', alignItems: 'flex-end' }} role="search">
        {mineOnly ? <HiddenField name="mine" value="1" /> : null}
        <ToolbarSelect aria-label="Which files" name="view" defaultValue={view}>
          {(Object.keys(VIEWS) as ViewKey[]).map((k) => (
            <option key={k} value={k}>
              {VIEWS[k].label}
            </option>
          ))}
        </ToolbarSelect>
        <TextField label="Find a file" name="q" defaultValue={query} placeholder="Address, MLS, escrow, client…" />
        <Button type="submit" touch style={{ alignSelf: 'flex-end' }}>
          Show
        </Button>
      </form>
      <ReportGrid
        label="All transaction files"
        columns={COLUMNS}
        template="minmax(220px, 2fr) minmax(120px, 1fr) minmax(110px, 1fr) minmax(100px, 0.8fr) minmax(130px, 1fr) minmax(140px, 1fr) minmax(150px, 1.2fr)"
        minWidth={1000}
        rows={gridRows}
        empty={query ? <>No file matches “{query}”. Try part of the street, a client name, or the MLS number.</> : <>No files in this view.</>}
      />
    </div>
  )
}
