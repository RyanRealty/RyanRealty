// @no-parity — internal admin tool (brokerage commission roll-up, TC rung 11)
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getCommissionsRollup, type TcCommissionRollupRow } from '@/app/actions/tc-commissions'

export const dynamic = 'force-dynamic'

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`
const d10 = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '—')

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  projected: { label: 'Projected', className: 'bg-warning/30 text-foreground hover:bg-warning/30' },
  settlement_verified: { label: 'Verified', className: 'bg-success/15 text-success hover:bg-success/15' },
  paid: { label: 'Paid', className: 'bg-primary text-primary-foreground hover:bg-primary' },
}

const SIDE_LABEL: Record<string, string> = {
  listing: 'Listing',
  buyer: 'Buyer',
  both: 'Both',
  unknown: '—',
}

type Totals = { n: number; gci: number; agent: number; brokerage: number }
const zero = (): Totals => ({ n: 0, gci: 0, agent: 0, brokerage: 0 })
function addTo(t: Totals, r: TcCommissionRollupRow) {
  t.n += 1
  t.gci += r.gci ?? 0
  t.agent += r.agent_net ?? 0
  t.brokerage += r.brokerage_net ?? 0
}

export default async function CommissionsPage() {
  const rows = await getCommissionsRollup()
  const earned = rows.filter((r) => r.status !== 'projected')
  const projected = rows.filter((r) => r.status === 'projected')

  const thisYear = String(new Date().getFullYear())
  const byBroker = new Map<string, { all: Totals; ytd: Totals }>()
  for (const r of earned) {
    const e = byBroker.get(r.broker_name) ?? { all: zero(), ytd: zero() }
    addTo(e.all, r)
    if ((r.closing_date ?? '').startsWith(thisYear)) addTo(e.ytd, r)
    byBroker.set(r.broker_name, e)
  }
  const officeAll = zero()
  const officeYtd = zero()
  for (const e of byBroker.values()) {
    officeAll.n += e.all.n
    officeAll.gci += e.all.gci
    officeAll.agent += e.all.agent
    officeAll.brokerage += e.all.brokerage
    officeYtd.n += e.ytd.n
    officeYtd.gci += e.ytd.gci
    officeYtd.agent += e.ytd.agent
    officeYtd.brokerage += e.ytd.brokerage
  }

  const sorted = [...rows].sort((a, b) => (b.closing_date ?? '').localeCompare(a.closing_date ?? ''))

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Commissions</h1>
          <p className="text-sm text-muted-foreground">
            Settlement-verified figures from the transaction record. Projections stay separate and never roll up.
          </p>
        </div>
        <Link
          href="/admin/financials"
          className="text-sm font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
        >
          Financials →
        </Link>
      </header>

      {/* Office + per-broker summary */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Office · {thisYear} YTD</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 tabular-nums">
            <p className="text-2xl font-bold text-foreground">{money(officeYtd.gci)}</p>
            <p className="text-xs text-muted-foreground">
              {officeYtd.n} closings · agents {money(officeYtd.agent)} · brokerage {money(officeYtd.brokerage)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Office · all time on record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 tabular-nums">
            <p className="text-2xl font-bold text-foreground">{money(officeAll.gci)}</p>
            <p className="text-xs text-muted-foreground">
              {officeAll.n} closings · agents {money(officeAll.agent)} · brokerage {money(officeAll.brokerage)}
            </p>
          </CardContent>
        </Card>
        {[...byBroker.entries()].map(([name, e]) => (
          <Card key={name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 tabular-nums">
              <p className="text-2xl font-bold text-foreground">{money(e.all.agent)}</p>
              <p className="text-xs text-muted-foreground">
                net all time · {e.all.n} closings · YTD {money(e.ytd.agent)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {projected.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">In escrow (projected)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {projected.map((r) => (
              <p key={r.id} className="text-sm tabular-nums text-muted-foreground">
                <Link
                  href={`/admin/deals/${encodeURIComponent(r.property_key ?? '')}`}
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  {r.address ?? r.cycle_id.slice(0, 8)}
                </Link>
                {' · '}
                {r.broker_name} · gross {money(r.gci)} · closes {d10(r.closing_date)}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Per-deal ledger */}
      <div>
        <div className="px-4 py-2">
          <p className="text-sm font-medium text-foreground">
            Ledger <span className="tabular-nums text-muted-foreground">({rows.length} rows)</span>
          </p>
        </div>

        {/* Deal cards — phones (one tap per deal, key money facts mirrored) */}
        <div className="space-y-2 md:hidden">
          {sorted.map((r) => {
            const st = STATUS_BADGE[r.status] ?? STATUS_BADGE.projected
            return (
              <Card key={r.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/deals/${encodeURIComponent(r.property_key ?? '')}`}
                      className="min-w-0 flex-1 truncate font-medium text-foreground underline-offset-2 hover:underline"
                      title={r.address ?? undefined}
                    >
                      {r.address ?? r.cycle_id.slice(0, 8)}
                    </Link>
                    <Badge className={`${st.className} shrink-0`}>{st.label}</Badge>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 tabular-nums">
                    <span className="text-lg font-bold text-foreground">{money(r.brokerage_net)}</span>
                    <span className="text-xs text-muted-foreground">brokerage net</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.broker_name} · {SIDE_LABEL[r.side]} · agent <span className="tabular-nums">{money(r.agent_net)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
                    <span>gross {money(r.gci)}</span>
                    <span>closed {d10(r.closing_date)}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Ledger table — desktop */}
        <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead className="w-36">Broker</TableHead>
              <TableHead className="w-20">Side</TableHead>
              <TableHead className="w-28 text-right">Sale price</TableHead>
              <TableHead className="w-24 text-right">Gross</TableHead>
              <TableHead className="w-24 text-right">Agent net</TableHead>
              <TableHead className="w-28 text-right">Brokerage net</TableHead>
              <TableHead className="w-28">Closed</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => {
              const st = STATUS_BADGE[r.status] ?? STATUS_BADGE.projected
              return (
                <TableRow key={r.id}>
                  <TableCell className="max-w-xs">
                    <Link
                      href={`/admin/deals/${encodeURIComponent(r.property_key ?? '')}`}
                      className="block truncate font-medium text-foreground underline-offset-2 hover:underline"
                      title={r.address ?? undefined}
                    >
                      {r.address ?? r.cycle_id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>{r.broker_name}</TableCell>
                  <TableCell>{SIDE_LABEL[r.side]}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.sale_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.gci)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.agent_net)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.brokerage_net)}</TableCell>
                  <TableCell className="tabular-nums">{d10(r.closing_date)}</TableCell>
                  <TableCell>
                    <Badge className={st.className}>{st.label}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </div>
      </div>
    </main>
  )
}
