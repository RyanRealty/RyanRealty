'use client'

/**
 * DSCR investment screen table. Ranked best-first, with property thumbnails,
 * the rent each property must earn, and the price it would have to be bought at
 * to pencil.
 *
 * P11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md)
 * and moved into the route's own _components/ (was
 * components/admin/dscr/DscrScreen.client.tsx). The <Table> became the hand-
 * rolled div/role grid (av2-rgrid* + report-grid.css) ConfigTableEditor
 * established, with an av2-cardlist phone fallback carrying every column the
 * desktop grid shows. DscrEmailDialog stays a mounted legacy island
 * (components/admin/dscr/DscrEmailDialog.client.tsx, still shadcn) — deferred
 * to its own unit, same as ProspectDetailPage/BpoBoard/CmaBoard elsewhere.
 *
 * Locale-formatter hydration fix (task_00b9af6e): `usd()` is gone — its two call
 * sites now call formatPriceExact (exact whole dollars, same rounding/sign
 * behavior it already had). `usdK()` stays as a local helper: formatPriceCompact
 * would change what ships for a negative delta ("-$50,000" instead of the
 * current "$-50K") and for any price at/above $1M ("$1.2M" instead of "$1,200K"),
 * so per the swap-only-if-precision-holds rule it was left alone. Every other
 * bare `.toLocaleString()` in this file (the stat tiles, sqft, the "top 300"
 * line) now pins `'en-US'` explicitly — same digits, no environment-dependent
 * locale left to resolve differently between server and client.
 */

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { DscrRow } from '@/lib/data/dscr/screen'
import { formatPriceExact } from '@/lib/format/money'
import { Button, SelectField, TextField, Switch } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
// Deferred legacy island (not one of this unit's 3 moves) — DscrEmailDialog
// still renders through shadcn/ui. Mounted as-is, same pattern already used
// for ProspectDetailPage/BpoBoard/CmaBoard elsewhere in the admin.
import { DscrEmailDialog } from '@/components/admin/dscr/DscrEmailDialog.client'

const usdK = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v / 1000).toLocaleString()}K`
const pct = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${v.toFixed(d)}%`)

/** Mirrors the DSCR-band color rule used on both the desktop grid and the phone cards. */
function dscrColor(dscr: number | null | undefined): string {
  if (dscr == null) return 'var(--a-text-2)'
  if (dscr >= 1.25) return 'var(--a-ok)'
  if (dscr >= 1) return 'var(--a-accent)'
  return 'var(--a-danger)'
}

type SortKey = 'dealScore' | 'dscr' | 'cashFlow' | 'delta' | 'price' | 'coc'

const GRID_COLS = '40px minmax(200px,1.4fr) 60px 76px 88px 80px 60px 90px 96px 80px 96px'
const GRID_MIN = '1180px'

/** Small label/value pair for the phone card's stat mini-grid. */
function MobileStat({ label, value, color, bold }: { label: string; value: React.ReactNode; color?: string; bold?: boolean }) {
  return (
    <span style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{label}</span>
      <span
        className="a-num"
        style={{ fontSize: 'var(--a-text-sm)', fontWeight: bold ? 600 : 500, color: color ?? 'var(--a-text)' }}
      >
        {value}
      </span>
    </span>
  )
}

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

  const visibleRows = filtered.slice(0, 300)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { k: 'Listings', v: stats.total.toLocaleString('en-US') },
          { k: 'Priced', v: stats.scored.toLocaleString('en-US') },
          { k: 'DSCR ≥ 1.00', v: stats.pass1.toLocaleString('en-US') },
          { k: 'DSCR ≥ 1.25', v: stats.pass125.toLocaleString('en-US') },
          { k: 'Cash flows', v: stats.positiveCf.toLocaleString('en-US') },
          { k: 'Median DSCR', v: stats.medianDscr?.toFixed(2) ?? '—' },
        ].map((s) => (
          <div key={s.k} className="av2-pane">
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--a-text-2)' }}>
              {s.k}
            </p>
            <p className="a-num" style={{ margin: 0, fontSize: 'var(--a-text-num)', fontWeight: 600, color: 'var(--a-text)' }}>
              {s.v}
            </p>
          </div>
        ))}
      </div>

      <div className="av2-pane">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <SelectField label="County" value={county} onChange={(e) => setCounty(e.target.value)}>
              <option value="all">All counties</option>
              {counties.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </SelectField>
          </div>
          <div className="w-32">
            <TextField
              label="Min DSCR"
              inputMode="decimal"
              placeholder="1.00"
              value={minDscr}
              onChange={(e) => setMinDscr(e.target.value)}
            />
          </div>
          <div className="w-40">
            <TextField
              label="Max price"
              inputMode="numeric"
              placeholder="600000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
          <div className="w-48">
            <SelectField label="Sort by" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              <option value="dealScore">Best deal (composite)</option>
              <option value="dscr">Best DSCR</option>
              <option value="cashFlow">Best cash flow</option>
              <option value="delta">Smallest price gap</option>
              <option value="coc">Best cash-on-cash</option>
              <option value="price">Lowest price</option>
            </SelectField>
          </div>
          <div className="pb-2">
            <Switch label="STR permit only" checked={strOnly} onChange={(e) => setStrOnly(e.target.checked)} />
          </div>
          <div className="ml-auto flex items-center gap-3 pb-2">
            {selected.size > 0 ? (
              <>
                <Button onClick={() => setEmailOpen(true)}>
                  Email {selected.size} selected
                </Button>
                <Button variant="quiet" onClick={() => setSelected(new Set())}>Clear</Button>
              </>
            ) : null}
          </div>
          <p className="pb-2" style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            {assumptions.downPct}% down · {assumptions.ratePct}% · {assumptions.termYears}yr ·
            {' '}{assumptions.vacancyPct + assumptions.mgmtPct + assumptions.maintPct + assumptions.capexPct}% opex
          </p>
        </div>
      </div>

      {/* Desktop grid — hidden below md; the phone card list below takes over */}
      <div className="hidden md:block">
        <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label="DSCR screen">
          <div className="av2-rgrid" role="table" aria-label="DSCR screen" style={{ '--rgrid-cols': GRID_COLS, '--rgrid-min': GRID_MIN } as React.CSSProperties}>
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h"><span className="sr-only">Select</span></span>
              <span role="columnheader" className="av2-rgrid__h">Property</span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Score</span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Price</span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Rent</span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">PITIA</span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">DSCR</span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Cash flow</span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Cash-on-cash</span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Buy at</span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Delta</span>
            </div>

            {visibleRows.map((r) => (
              <div
                key={r.listingKey}
                role="row"
                className="av2-rgrid__row"
                style={selected.has(r.listingKey) ? { background: 'var(--a-accent-wash)' } : undefined}
              >
                <span role="cell" data-label="" className="av2-rgrid__c">
                  <Switch
                    label={`Select ${r.address}`}
                    labelHidden
                    checked={selected.has(r.listingKey)}
                    onChange={() => toggle(r.listingKey)}
                  />
                </span>

                <span role="cell" data-label="Property" className="av2-rgrid__c">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-md" style={{ display: 'block', background: 'var(--a-inset)' }}>
                      {r.photoUrl ? (
                        <Image src={r.photoUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
                      ) : null}
                    </span>
                    <span style={{ minWidth: 0, display: 'block' }}>
                      <Link href={r.listingUrl} className="block truncate" style={{ fontWeight: 500, color: 'var(--a-text)' }}>
                        {r.address || 'Address unavailable'}
                      </Link>
                      <span className="block truncate" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                        {r.city}
                        {r.beds != null ? ` · ${r.beds}bd` : ''}
                        {r.sqft ? ` · ${r.sqft.toLocaleString('en-US')} sqft` : ''}
                        {r.propertySubType ? ` · ${r.propertySubType}` : ''}
                      </span>
                      {r.strPermit ? (
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: 4,
                            fontSize: 'var(--a-text-xs)',
                            color: 'var(--a-text-2)',
                            border: '1px solid var(--a-border)',
                            borderRadius: 'var(--a-r-sm)',
                            padding: '1px 6px',
                          }}
                        >
                          STR
                        </span>
                      ) : null}
                    </span>
                  </span>
                </span>

                <span role="cell" data-label="Score" className="av2-rgrid__c av2-rgrid__c--n" style={{ fontWeight: 600, color: 'var(--a-text)' }}>
                  {r.dealScore?.toFixed(1) ?? <span style={{ fontWeight: 400, color: 'var(--a-text-2)' }}>—</span>}
                </span>

                <span role="cell" data-label="Price" className="av2-rgrid__c av2-rgrid__c--n">{usdK(r.price)}</span>

                <span role="cell" data-label="Rent" className="av2-rgrid__c av2-rgrid__c--n">
                  {formatPriceExact(r.rent)}
                  {r.rent == null ? null : (
                    <span className="block" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                      {r.rentSource === 'zillow-rentzestimate' ? 'Zillow' : 'HUD'}
                    </span>
                  )}
                </span>

                <span role="cell" data-label="PITIA" className="av2-rgrid__c av2-rgrid__c--n">{formatPriceExact(r.pitia)}</span>

                <span role="cell" data-label="DSCR" className="av2-rgrid__c av2-rgrid__c--n" style={{ fontWeight: 600, color: dscrColor(r.dscr) }}>
                  {r.dscr?.toFixed(2) ?? '—'}
                </span>

                <span
                  role="cell"
                  data-label="Cash flow"
                  className="av2-rgrid__c av2-rgrid__c--n"
                  style={{ color: (r.cashFlowMonthly ?? 0) > 0 ? 'var(--a-ok)' : 'var(--a-danger)' }}
                >
                  {formatPriceExact(r.cashFlowMonthly)}
                </span>

                <span role="cell" data-label="Cash-on-cash" className="av2-rgrid__c av2-rgrid__c--n">{pct(r.cashOnCashPct)}</span>

                <span role="cell" data-label="Buy at" className="av2-rgrid__c av2-rgrid__c--n">{usdK(r.maxPriceForDscr)}</span>

                <span
                  role="cell"
                  data-label="Delta"
                  className="av2-rgrid__c av2-rgrid__c--n"
                  style={{ color: (r.priceDeltaPct ?? 0) >= 0 ? 'var(--a-ok)' : 'var(--a-danger)' }}
                >
                  {r.priceDelta == null ? '—' : (
                    <>
                      {usdK(r.priceDelta)}
                      <span className="block" style={{ fontSize: 'var(--a-text-xs)', opacity: 0.7 }}>{pct(r.priceDeltaPct)}</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Phone card list — visible below md, carries every column the desktop grid shows */}
      <div className="av2-cardlist">
        {visibleRows.map((r) => (
          <div
            key={r.listingKey}
            className="av2-pane"
            style={{ background: selected.has(r.listingKey) ? 'var(--a-accent-wash)' : 'var(--a-bg)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Switch
                label={`Select ${r.address}`}
                labelHidden
                checked={selected.has(r.listingKey)}
                onChange={() => toggle(r.listingKey)}
              />
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md" style={{ background: 'var(--a-inset)' }}>
                {r.photoUrl ? (
                  <Image src={r.photoUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
                ) : null}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Link href={r.listingUrl} className="block truncate" style={{ fontWeight: 500, color: 'var(--a-text)' }}>
                  {r.address || 'Address unavailable'}
                </Link>
                <p className="truncate" style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  {r.city}
                  {r.beds != null ? ` · ${r.beds}bd` : ''}
                  {r.sqft ? ` · ${r.sqft.toLocaleString('en-US')} sqft` : ''}
                  {r.propertySubType ? ` · ${r.propertySubType}` : ''}
                </p>
                {r.strPermit ? (
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 4,
                      fontSize: 'var(--a-text-xs)',
                      color: 'var(--a-text-2)',
                      border: '1px solid var(--a-border)',
                      borderRadius: 'var(--a-r-sm)',
                      padding: '1px 6px',
                    }}
                  >
                    STR
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2" style={{ gap: 8, marginTop: 10, borderTop: '1px solid var(--a-border)', paddingTop: 10 }}>
              <MobileStat label="Score" value={r.dealScore?.toFixed(1) ?? '—'} bold />
              <MobileStat label="Price" value={usdK(r.price)} />
              <MobileStat label="Rent" value={formatPriceExact(r.rent)} />
              <MobileStat label="PITIA" value={formatPriceExact(r.pitia)} />
              <MobileStat label="DSCR" value={r.dscr?.toFixed(2) ?? '—'} color={dscrColor(r.dscr)} bold />
              <MobileStat
                label="Cash flow"
                value={formatPriceExact(r.cashFlowMonthly)}
                color={(r.cashFlowMonthly ?? 0) > 0 ? 'var(--a-ok)' : 'var(--a-danger)'}
              />
              <MobileStat label="Cash-on-cash" value={pct(r.cashOnCashPct)} />
              <MobileStat label="Buy at" value={usdK(r.maxPriceForDscr)} />
              <MobileStat
                label="Delta"
                value={r.priceDelta == null ? '—' : `${usdK(r.priceDelta)} (${pct(r.priceDeltaPct)})`}
                color={(r.priceDeltaPct ?? 0) >= 0 ? 'var(--a-ok)' : 'var(--a-danger)'}
              />
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 300 ? (
        <p
          className="text-center"
          style={{ margin: 0, borderTop: '1px solid var(--a-border)', padding: 'var(--a-s3)', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
        >
          Showing the top 300 of {filtered.length.toLocaleString('en-US')}. Narrow the filters to see more.
        </p>
      ) : null}
      <div className="space-y-1" style={{ borderTop: '1px solid var(--a-border)', padding: 'var(--a-s4)', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        <p style={{ margin: 0 }}>
          <strong style={{ color: 'var(--a-text)' }}>Score</strong> ranks each property against current
          inventory on four measures: cash-on-cash return (40%), DSCR headroom over 1.00 (25%),
          monthly cash flow in dollars (20%), and price margin against asking (15%). A property with
          no rent estimate is left unscored rather than scored zero.
        </p>
        <p style={{ margin: 0 }}>
          DSCR is the lender&apos;s test and ignores operating costs, so roughly{' '}
          <strong style={{ color: 'var(--a-text)' }}>1.30</strong> is where a property actually breaks even.
          Rent on manufactured homes is the least reliable figure here, since the comp sets behind it
          are thin.
        </p>
      </div>

      <DscrEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        listingKeys={[...selected]}
        pricedCount={rows.filter((r) => selected.has(r.listingKey) && r.rent != null).length}
      />
    </div>
  )
}
