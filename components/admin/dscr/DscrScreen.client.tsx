'use client'

/**
 * DSCR investment screen table. Ranked best-first, with property thumbnails,
 * the rent each property must earn, and the price it would have to be bought at
 * to pencil.
 */

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { DscrRow } from '@/lib/data/dscr/screen'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { DscrEmailDialog } from './DscrEmailDialog.client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const usd = (v: number | null | undefined) =>
  v == null ? '—' : v < 0 ? `-$${Math.abs(Math.round(v)).toLocaleString()}` : `$${Math.round(v).toLocaleString()}`
const usdK = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v / 1000).toLocaleString()}K`
const pct = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${v.toFixed(d)}%`)

type SortKey = 'dealScore' | 'dscr' | 'cashFlow' | 'delta' | 'price' | 'coc'

export function DscrScreen({ rows, assumptions }: { rows: DscrRow[]; assumptions: Record<string, number> }) {
  const [county, setCounty] = useState('all')
  const [minDscr, setMinDscr] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [strOnly, setStrOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('dealScore')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [emailOpen, setEmailOpen] = useState(false)

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const counties = useMemo(
    () => Array.from(new Set(rows.map((r) => r.county).filter(Boolean))).sort() as string[],
    [rows],
  )

  const filtered = useMemo(() => {
    const min = minDscr ? Number(minDscr) : null
    const max = maxPrice ? Number(maxPrice.replace(/[^0-9]/g, '')) : null
    const out = rows.filter((r) => {
      if (county !== 'all' && r.county !== county) return false
      if (min != null && (r.dscr == null || r.dscr < min)) return false
      if (max != null && r.price > max) return false
      if (strOnly && !r.strPermit) return false
      return true
    })
    const by: Record<SortKey, (a: DscrRow, b: DscrRow) => number> = {
      dealScore: (a, b) => (b.dealScore ?? -1) - (a.dealScore ?? -1),
      dscr: (a, b) => (b.dscr ?? -1) - (a.dscr ?? -1),
      cashFlow: (a, b) => (b.cashFlowMonthly ?? -Infinity) - (a.cashFlowMonthly ?? -Infinity),
      delta: (a, b) => (b.priceDeltaPct ?? -Infinity) - (a.priceDeltaPct ?? -Infinity),
      price: (a, b) => a.price - b.price,
      coc: (a, b) => (b.cashOnCashPct ?? -Infinity) - (a.cashOnCashPct ?? -Infinity),
    }
    return out.sort(by[sortKey])
  }, [rows, county, minDscr, maxPrice, strOnly, sortKey])

  const scored = filtered.filter((r) => r.dscr != null)
  const stats = {
    total: filtered.length,
    scored: scored.length,
    pass1: scored.filter((r) => (r.dscr ?? 0) >= 1).length,
    pass125: scored.filter((r) => (r.dscr ?? 0) >= 1.25).length,
    positiveCf: scored.filter((r) => (r.cashFlowMonthly ?? 0) > 0).length,
    medianDscr: scored.length
      ? [...scored].sort((a, b) => (a.dscr ?? 0) - (b.dscr ?? 0))[Math.floor(scored.length / 2)].dscr
      : null,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { k: 'Listings', v: stats.total.toLocaleString() },
          { k: 'Priced', v: stats.scored.toLocaleString() },
          { k: 'DSCR ≥ 1.00', v: stats.pass1.toLocaleString() },
          { k: 'DSCR ≥ 1.25', v: stats.pass125.toLocaleString() },
          { k: 'Cash flows', v: stats.positiveCf.toLocaleString() },
          { k: 'Median DSCR', v: stats.medianDscr?.toFixed(2) ?? '—' },
        ].map((s) => (
          <Card key={s.k}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.k}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="w-48">
            <Label htmlFor="county" className="text-xs">County</Label>
            <Select value={county} onValueChange={setCounty}>
              <SelectTrigger id="county" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All counties</SelectItem>
                {counties.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Label htmlFor="mindscr" className="text-xs">Min DSCR</Label>
            <Input id="mindscr" className="mt-1" inputMode="decimal" placeholder="1.00"
              value={minDscr} onChange={(e) => setMinDscr(e.target.value)} />
          </div>
          <div className="w-40">
            <Label htmlFor="maxprice" className="text-xs">Max price</Label>
            <Input id="maxprice" className="mt-1" inputMode="numeric" placeholder="600000"
              value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </div>
          <div className="w-48">
            <Label htmlFor="sort" className="text-xs">Sort by</Label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger id="sort" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dealScore">Best deal (composite)</SelectItem>
                <SelectItem value="dscr">Best DSCR</SelectItem>
                <SelectItem value="cashFlow">Best cash flow</SelectItem>
                <SelectItem value="delta">Smallest price gap</SelectItem>
                <SelectItem value="coc">Best cash-on-cash</SelectItem>
                <SelectItem value="price">Lowest price</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox id="stronly" checked={strOnly} onCheckedChange={(v) => setStrOnly(v === true)} />
            <Label htmlFor="stronly" className="text-sm font-normal">STR permit only</Label>
          </div>
          <div className="ml-auto flex items-center gap-3 pb-2">
            {selected.size > 0 ? (
              <>
                <Button size="sm" onClick={() => setEmailOpen(true)}>
                  Email {selected.size} selected
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
              </>
            ) : null}
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            {assumptions.downPct}% down · {assumptions.ratePct}% · {assumptions.termYears}yr ·
            {' '}{assumptions.vacancyPct + assumptions.mgmtPct + assumptions.maintPct + assumptions.capexPct}% opex
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto no-scrollbar p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>
                <TableHead className="w-72">Property</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead className="text-right">PITIA</TableHead>
                <TableHead className="text-right">DSCR</TableHead>
                <TableHead className="text-right">Cash flow</TableHead>
                <TableHead className="text-right">Cash-on-cash</TableHead>
                <TableHead className="text-right">Buy at</TableHead>
                <TableHead className="text-right">Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 300).map((r) => (
                <TableRow key={r.listingKey} data-state={selected.has(r.listingKey) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.listingKey)}
                      onCheckedChange={() => toggle(r.listingKey)}
                      aria-label={`Select ${r.address}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                        {r.photoUrl ? (
                          <Image src={r.photoUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <Link href={r.listingUrl} className="block truncate font-medium hover:underline">
                          {r.address || 'Address unavailable'}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.city}
                          {r.beds != null ? ` · ${r.beds}bd` : ''}
                          {r.sqft ? ` · ${r.sqft.toLocaleString()} sqft` : ''}
                          {r.propertySubType ? ` · ${r.propertySubType}` : ''}
                        </p>
                        {r.strPermit ? <Badge variant="secondary" className="mt-1">STR</Badge> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {r.dealScore?.toFixed(1) ?? <span className="font-normal text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{usdK(r.price)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {usd(r.rent)}
                    {r.rent == null ? null : (
                      <span className="block text-xs text-muted-foreground">
                        {r.rentSource === 'zillow-rentzestimate' ? 'Zillow' : 'HUD'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{usd(r.pitia)}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-semibold tabular-nums',
                      r.dscr == null ? 'text-muted-foreground'
                        : r.dscr >= 1.25 ? 'text-success'
                        : r.dscr >= 1 ? 'text-primary'
                        : 'text-destructive',
                    )}
                  >
                    {r.dscr?.toFixed(2) ?? '—'}
                  </TableCell>
                  <TableCell
                    className={cn('text-right tabular-nums',
                      (r.cashFlowMonthly ?? 0) > 0 ? 'text-success' : 'text-destructive')}
                  >
                    {usd(r.cashFlowMonthly)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{pct(r.cashOnCashPct)}</TableCell>
                  <TableCell className="text-right tabular-nums">{usdK(r.maxPriceForDscr)}</TableCell>
                  <TableCell
                    className={cn('text-right tabular-nums',
                      (r.priceDeltaPct ?? 0) >= 0 ? 'text-success' : 'text-destructive')}
                  >
                    {r.priceDelta == null ? '—' : (
                      <>
                        {usdK(r.priceDelta)}
                        <span className="block text-xs opacity-70">{pct(r.priceDeltaPct)}</span>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 300 ? (
            <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">
              Showing the top 300 of {filtered.length.toLocaleString()}. Narrow the filters to see more.
            </p>
          ) : null}
          <div className="space-y-1 border-t border-border p-4 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Score</strong> ranks each property against current
              inventory on four measures: cash-on-cash return (40%), DSCR headroom over 1.00 (25%),
              monthly cash flow in dollars (20%), and price margin against asking (15%). A property with
              no rent estimate is left unscored rather than scored zero.
            </p>
            <p>
              DSCR is the lender&apos;s test and ignores operating costs, so roughly{' '}
              <strong className="text-foreground">1.30</strong> is where a property actually breaks even.
              Rent on manufactured homes is the least reliable figure here, since the comp sets behind it
              are thin.
            </p>
          </div>
        </CardContent>
      </Card>

      <DscrEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        listingKeys={[...selected]}
        pricedCount={rows.filter((r) => selected.has(r.listingKey) && r.rent != null).length}
      />
    </div>
  )
}
