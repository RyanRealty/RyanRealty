// @no-parity — internal admin tool (deal pipeline dashboard), no public mockup contract
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getDealDashboard, type DealCycle, type DealProperty } from '@/app/actions/deals'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/* ---------- helpers (render-side only) ---------- */

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`

const d10 = (v: string | null | undefined) => (v ? v.slice(0, 10) : '—')

type Step = { label: string; state: 'done' | 'open' | 'na' }

const SALE_STEPS: Array<{ label: string; match: RegExp }> = [
  { label: 'Agreement', match: /residential (sale|purchase) agreement/i },
  { label: 'Earnest money', match: /earnest money receipt/i },
  { label: 'Disclosures', match: /sellers property disclosure/i },
  { label: 'Title', match: /preliminary title/i },
  { label: 'Repairs', match: /repair addendum|professional inspection/i },
  { label: 'HOA docs', match: /association documents/i },
  { label: 'Closing stmt', match: /closing statement|final hud/i },
  { label: 'Broker notes', match: /broker notes/i },
]

const LISTING_STEPS: Array<{ label: string; match: RegExp }> = [
  { label: 'Listing agreement', match: /listing agreement/i },
  { label: 'Agency disclosure', match: /initial agency disclosure/i },
  { label: 'MLS input', match: /mls residential input/i },
  { label: 'Seller disclosures', match: /sellers property disclosure/i },
]

function computeSteps(cycle: DealCycle): Step[] {
  const defs = cycle.kind === 'listings' ? LISTING_STEPS : SALE_STEPS
  const activities = cycle.checklist.activities ?? []
  return defs.map(({ label, match }) => {
    const hits = activities.filter((a) => match.test(a.name))
    if (hits.some((a) => a.docCount > 0)) return { label, state: 'done' as const }
    if (hits.some((a) => a.status === 'Required' || a.status === 'In Review'))
      return { label, state: 'open' as const }
    return { label, state: 'na' as const }
  })
}

function StepTracker({ cycle }: { cycle: DealCycle }) {
  const steps = computeSteps(cycle)
  return (
    <ol className="flex flex-wrap items-start gap-x-1 gap-y-3" aria-label="Transaction progress">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-start">
          <div className="flex w-16 flex-col items-center gap-1 text-center">
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums',
                s.state === 'done' && 'border-success bg-success text-success-foreground',
                s.state === 'open' && 'border-warning bg-warning/15 text-foreground',
                s.state === 'na' && 'border-border bg-muted text-muted-foreground'
              )}
              aria-hidden
            >
              {s.state === 'done' ? '✓' : s.state === 'open' ? '!' : '–'}
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground">{s.label}</span>
          </div>
          {i < steps.length - 1 ? (
            <span className="mt-3 hidden h-px w-3 shrink-0 bg-border sm:block" aria-hidden />
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function ComplianceBadge({ state }: { state: DealProperty['rollup']['complianceState'] }) {
  if (state === 'clean')
    return <Badge className="bg-success/15 text-success hover:bg-success/15">Clean</Badge>
  if (state === 'legal_flag')
    return <Badge variant="destructive">Legal flag</Badge>
  return <Badge className="bg-warning/20 text-foreground hover:bg-warning/20">Action needed</Badge>
}

function ClosedCard({ p }: { p: DealProperty }) {
  const h = p.headline
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/admin/deals/${encodeURIComponent(p.key)}`}
            className="min-w-0 text-sm font-medium text-foreground hover:underline"
          >
            {p.address}
          </Link>
          <ComplianceBadge state={p.rollup.complianceState} />
        </div>
        {p.zombie ? (
          <p className="mt-1 text-xs text-warning" title={p.zombie}>
            ⚠ zombie folder
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-foreground">
          <span>{money(h.salePrice)}</span>
          <span className="text-muted-foreground">gross {money(h.officeGross)}</span>
          <span className="text-muted-foreground">closed {d10(h.actualClosingDate)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{p.broker ?? '—'}</span>
          <BnBadge state={h.brokerNotesState} />
        </div>
      </CardContent>
    </Card>
  )
}

function BnBadge({ state }: { state: DealCycle['brokerNotesState'] }) {
  if (state === 'ok') return <Badge className="bg-success/15 text-success hover:bg-success/15">BN ✓</Badge>
  if (state === 'needs_regeneration') return <Badge variant="destructive">BN regen</Badge>
  if (state === 'refresh_suggested')
    return <Badge className="bg-warning/20 text-foreground hover:bg-warning/20">BN refresh</Badge>
  if (state === 'MISSING') return <Badge variant="destructive">BN missing</Badge>
  return <Badge variant="outline">no BN</Badge>
}

function actionItems(p: DealProperty): string[] {
  const out: string[] = []
  for (const c of p.cycles) {
    for (const g of c.docGaps) out.push(`${g.gap} — ${g.fix}`)
    for (const f of c.complianceFlags) out.push(f.flag)
    if (c.brokerNotesState === 'needs_regeneration') out.push(`Regenerate Broker Notes (${c.guid8})`)
    if (c.brokerNotesState === 'refresh_suggested') out.push(`Refresh Broker Notes (${c.guid8})`)
    if (
      (c.status === 'Pending' || (c.kind === 'listings' && c.status === 'Active')) &&
      c.requiredOpen.length
    )
      out.push(`Open required items: ${c.requiredOpen.join(', ')}`)
  }
  if (p.zombie) out.push(p.zombie)
  return out
}

/* ---------- page ---------- */

export default async function DealsPage() {
  const data = await getDealDashboard()
  const { properties, totals } = data

  const live = properties.filter((p) => ['pending', 'active_listing', 'pre_contract'].includes(p.stage))
  const closed = properties
    .filter((p) => p.stage === 'closed')
    .sort((a, b) =>
      (b.headline.actualClosingDate ?? '').localeCompare(a.headline.actualClosingDate ?? '')
    )
  const dead = properties.filter((p) => p.stage === 'dead')

  // Curate, never dump: phones show the most-recent few, then disclose the rest.
  const CLOSED_PREVIEW = 6
  const ACTION_PREVIEW = 5
  const closedPreview = closed.slice(0, CLOSED_PREVIEW)
  const closedRest = closed.slice(CLOSED_PREVIEW)

  const actionProps = properties.filter((p) => p.rollup.complianceState !== 'clean' || p.zombie)
  const actionPreview = actionProps.slice(0, ACTION_PREVIEW)
  const actionRest = actionProps.slice(ACTION_PREVIEW)

  const FINDINGS_PREVIEW = 8
  const findingsPreview = data.systemFindings.slice(0, FINDINGS_PREVIEW)
  const findingsRest = data.systemFindings.slice(FINDINGS_PREVIEW)

  const pendingProps = properties.filter((p) => p.stage === 'pending')
  const pendingVolume = pendingProps.reduce((s, p) => s + (p.headline?.salePrice ?? 0), 0)
  const year = new Date().getFullYear().toString()
  const ytd = totals.byYear?.[year] ?? { count: 0, volume: 0, gross: 0 }
  const openItems = properties.reduce(
    (s, p) => s + p.rollup.openFlagCount + p.rollup.docGapCount + p.rollup.bnActionCount,
    0
  )

  if (data.source === 'empty') {
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Deals</h1>
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            No transaction snapshot found. Run{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">
              node --env-file=.env.local scripts/skyslope-dashboard-refresh.mjs
            </code>{' '}
            to sync from SkySlope.
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Deals</h1>
          <p className="text-sm text-muted-foreground">
            Every SkySlope transaction — live pipeline, closed-file compliance, and open action items.
            {data.syncedAt ? ` Synced ${d10(data.syncedAt)}.` : null}
            {data.source === 'local-file' ? ' (dev preview: reading local master.json)' : null}
          </p>
        </div>
        <Link
          href="/admin/commissions"
          className="text-sm font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
        >
          Commissions →
        </Link>
      </header>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Under contract</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{pendingProps.length}</p>
            <p className="text-xs tabular-nums text-muted-foreground">{money(pendingVolume)} in escrow</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active listings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {properties.filter((p) => p.stage === 'active_listing').length}
            </p>
            <p className="text-xs text-muted-foreground">on market</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Closed {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{ytd.count}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {money(ytd.volume)} volume · {money(ytd.gross)} gross
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open action items</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                'text-2xl font-semibold tabular-nums',
                openItems > 0 ? 'text-destructive' : 'text-success'
              )}
            >
              {openItems}
            </p>
            <p className="text-xs text-muted-foreground">flags, gaps + notes to fix</p>
          </CardContent>
        </Card>
      </div>

      {/* Live pipeline */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Live pipeline</h2>
        {live.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing in flight.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {live.map((p) => {
              const h = p.headline
              const items = actionItems(p)
              const pct = h.checklist.activityCount
                ? Math.round((h.checklist.filledCount / h.checklist.activityCount) * 100)
                : 0
              return (
                <Card key={p.key} className={cn(p.zombie && 'border-warning')}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          <Link
                            href={`/admin/deals/${encodeURIComponent(p.key)}`}
                            className="hover:underline"
                          >
                            {p.address}
                          </Link>
                        </CardTitle>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.broker ?? '—'} · {p.stageDetail}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          p.stage === 'pending' && 'bg-primary text-primary-foreground hover:bg-primary',
                          p.stage === 'active_listing' && 'bg-success/15 text-success hover:bg-success/15',
                          p.stage === 'pre_contract' && 'bg-warning/20 text-foreground hover:bg-warning/20'
                        )}
                      >
                        {p.stage === 'pending'
                          ? 'Under contract'
                          : p.stage === 'active_listing'
                            ? 'Active'
                            : 'Pre-contract'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums text-foreground">
                      {h.salePrice ? <span>{money(h.salePrice)}</span> : null}
                      {h.officeGross ? (
                        <span className="text-muted-foreground">gross {money(h.officeGross)}</span>
                      ) : null}
                      {h.escrowClosingDate ? (
                        <span className="text-muted-foreground">closes {d10(h.escrowClosingDate)}</span>
                      ) : null}
                      {h.expirationDate && h.kind === 'listings' ? (
                        <span className="text-muted-foreground">expires {d10(h.expirationDate)}</span>
                      ) : null}
                      {h.mlsNumber ? <span className="text-muted-foreground">MLS {h.mlsNumber}</span> : null}
                    </div>

                    <StepTracker cycle={h} />

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Checklist {h.checklist.filledCount}/{h.checklist.activityCount} filled
                        </span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <Progress value={pct} aria-label="Checklist progress" />
                    </div>

                    {items.length > 0 ? (
                      <ul className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-foreground">
                        {items.map((it) => (
                          <li key={it} className="flex gap-2">
                            <span aria-hidden>•</span>
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Closed compliance */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-foreground">Closed transactions</h2>
          <p className="text-xs tabular-nums text-muted-foreground">
            {totals.closedDeals} deals ·{' '}
            {money(Object.values(totals.byYear ?? {}).reduce((s, y) => s + y.volume, 0))} lifetime volume
          </p>
        </div>
        {/* Closed cards — phones: most recent few, rest behind a disclosure */}
        <div className="space-y-2 md:hidden">
          {closed.length === 0 ? (
            <Card>
              <CardContent className="space-y-1 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No closed transactions yet</p>
                <p className="text-sm text-muted-foreground">
                  Closed files appear here once a deal settles in SkySlope.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {closedPreview.map((p) => (
                <ClosedCard key={p.key} p={p} />
              ))}
              {closedRest.length > 0 ? (
                <Accordion type="single" collapsible>
                  <AccordionItem value="closed-rest" className="border-0">
                    <AccordionTrigger className="min-h-11 justify-center gap-2 text-sm font-medium text-foreground hover:no-underline">
                      See all {closed.length} closed
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 pt-1">
                      {closedRest.map((p) => (
                        <ClosedCard key={p.key} p={p} />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}
            </>
          )}
        </div>

        {/* Closed table — desktop */}
        <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead className="text-right">Sale price</TableHead>
                <TableHead className="text-right">Office gross</TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Broker notes</TableHead>
                <TableHead>Compliance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closedPreview.map((p) => {
                const h = p.headline
                return (
                  <TableRow key={p.key}>
                    <TableCell className="font-medium text-foreground">
                      <Link href={`/admin/deals/${encodeURIComponent(p.key)}`} className="hover:underline">
                        {p.address}
                      </Link>
                      {p.zombie ? (
                        <span className="ml-2 text-xs text-warning" title={p.zombie}>
                          ⚠ zombie folder
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums">{d10(h.actualClosingDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(h.salePrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(h.officeGross)}</TableCell>
                    <TableCell>{p.broker ?? '—'}</TableCell>
                    <TableCell>
                      <BnBadge state={h.brokerNotesState} />
                    </TableCell>
                    <TableCell>
                      <ComplianceBadge state={p.rollup.complianceState} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {closedRest.length > 0 ? (
            <Accordion type="single" collapsible>
              <AccordionItem value="closed-table-rest" className="border-t border-border">
                <AccordionTrigger className="min-h-11 justify-center gap-2 px-4 text-sm font-medium text-foreground hover:no-underline">
                  See all {closed.length} closed
                </AccordionTrigger>
                <AccordionContent className="pt-0">
                  <Table>
                    <TableBody>
                      {closedRest.map((p) => {
                        const h = p.headline
                        return (
                          <TableRow key={p.key}>
                            <TableCell className="font-medium text-foreground">
                              <Link href={`/admin/deals/${encodeURIComponent(p.key)}`} className="hover:underline">
                                {p.address}
                              </Link>
                              {p.zombie ? (
                                <span className="ml-2 text-xs text-warning" title={p.zombie}>
                                  ⚠ zombie folder
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="tabular-nums">{d10(h.actualClosingDate)}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(h.salePrice)}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(h.officeGross)}</TableCell>
                            <TableCell>{p.broker ?? '—'}</TableCell>
                            <TableCell>
                              <BnBadge state={h.brokerNotesState} />
                            </TableCell>
                            <TableCell>
                              <ComplianceBadge state={p.rollup.complianceState} />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
        </div>
      </section>

      {/* Action items */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Action items</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Per-deal items</CardTitle>
            </CardHeader>
            <CardContent>
              {actionProps.length === 0 ? (
                <p className="text-sm text-success">All clear — no deals need attention.</p>
              ) : (
                <>
                  <ul className="space-y-3 text-sm">
                    {actionPreview.map((p) => (
                      <li key={p.key}>
                        <Link
                          href={`/admin/deals/${encodeURIComponent(p.key)}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {p.address}
                        </Link>
                        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {actionItems(p).map((it) => (
                            <li key={it} className="flex gap-2">
                              <span aria-hidden>•</span>
                              <span>{it}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  {actionRest.length > 0 ? (
                    <Accordion type="single" collapsible className="mt-2">
                      <AccordionItem value="action-rest" className="border-0">
                        <AccordionTrigger className="min-h-11 justify-center gap-2 text-sm font-medium text-foreground hover:no-underline">
                          See all {actionProps.length} deals needing attention
                        </AccordionTrigger>
                        <AccordionContent className="pt-1">
                          <ul className="space-y-3 text-sm">
                            {actionRest.map((p) => (
                              <li key={p.key}>
                                <Link
                                  href={`/admin/deals/${encodeURIComponent(p.key)}`}
                                  className="font-medium text-foreground hover:underline"
                                >
                                  {p.address}
                                </Link>
                                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                                  {actionItems(p).map((it) => (
                                    <li key={it} className="flex gap-2">
                                      <span aria-hidden>•</span>
                                      <span>{it}</span>
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">System findings</CardTitle>
            </CardHeader>
            <CardContent>
              {data.systemFindings.length === 0 && !data.bnReview ? (
                <p className="text-sm text-muted-foreground">No system findings.</p>
              ) : null}
              <ul className="space-y-2 text-xs text-muted-foreground">
                {findingsPreview.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {findingsRest.length > 0 ? (
                <Accordion type="single" collapsible className="mt-2">
                  <AccordionItem value="findings-rest" className="border-0">
                    <AccordionTrigger className="min-h-11 justify-center gap-2 text-sm font-medium text-foreground hover:no-underline">
                      See all {data.systemFindings.length} findings
                    </AccordionTrigger>
                    <AccordionContent className="pt-1">
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        {findingsRest.map((f) => (
                          <li key={f} className="flex gap-2">
                            <span aria-hidden>•</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}
              {data.bnReview ? (
                <>
                  <Separator className="my-3" />
                  <p className="text-xs text-muted-foreground">
                    Broker Notes review: {data.bnReview.total} read — {data.bnReview.clean} clean,{' '}
                    {data.bnReview.minor} minor, {data.bnReview.needsCorrection} need regeneration.
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Canceled / dead */}
      <section>
        <Accordion type="single" collapsible>
          <AccordionItem value="dead">
            <AccordionTrigger className="text-sm font-semibold text-foreground">
              Canceled / dead files ({dead.length})
            </AccordionTrigger>
            <AccordionContent>
              {/* Dead cards — phones */}
              <div className="space-y-2 md:hidden">
                {dead.map((p) => {
                  const lastDead = p.cycles
                    .map((c) => c.deadDate)
                    .filter(Boolean)
                    .sort()
                    .at(-1)
                  const docs = p.cycles.reduce((s, c) => s + c.docs.live, 0)
                  const term = p.cycles.some((c) =>
                    (c.checklist.activities ?? []).some(
                      (a) => /termination/i.test(a.name) && a.docCount > 0
                    )
                  )
                  return (
                    <Card key={p.key}>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium text-foreground">{p.address}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
                          <span>{p.cycles.length} folders</span>
                          <span>dead {lastDead ?? '—'}</span>
                          <span>{docs} docs</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {actionItems(p).slice(0, 2).join(' · ') || (term ? 'termination on file' : '—')}
                        </p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Dead table — desktop */}
              <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Folders</TableHead>
                      <TableHead>Last dead date</TableHead>
                      <TableHead>Docs (live)</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dead.map((p) => {
                      const lastDead = p.cycles
                        .map((c) => c.deadDate)
                        .filter(Boolean)
                        .sort()
                        .at(-1)
                      const docs = p.cycles.reduce((s, c) => s + c.docs.live, 0)
                      const term = p.cycles.some((c) =>
                        (c.checklist.activities ?? []).some(
                          (a) => /termination/i.test(a.name) && a.docCount > 0
                        )
                      )
                      return (
                        <TableRow key={p.key}>
                          <TableCell className="font-medium text-foreground">{p.address}</TableCell>
                          <TableCell className="tabular-nums">{p.cycles.length}</TableCell>
                          <TableCell className="tabular-nums">{lastDead ?? '—'}</TableCell>
                          <TableCell className="tabular-nums">{docs}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {actionItems(p).slice(0, 2).join(' · ') || (term ? 'termination on file' : '—')}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <p className="text-xs text-muted-foreground">
        Source: SkySlope Files API snapshot · metadata settlement-verified per{' '}
        <Link href="/admin/audit-log" className="underline underline-offset-2">
          audit trail
        </Link>
        . Refresh: <code className="rounded bg-muted px-1 py-0.5">scripts/skyslope-dashboard-refresh.mjs</code>
      </p>
    </main>
  )
}
