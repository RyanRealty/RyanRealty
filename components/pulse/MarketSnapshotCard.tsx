'use client'

import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import type { PulseCitySnapshot } from '@/app/actions/pulse-feed'

type Props = {
  snapshot: PulseCitySnapshot
  scope?: 'region' | 'city'
}

function formatPriceShort(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 2)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function formatMonths(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)} mo`
}

function formatHealth(label: string | null | undefined, mos: number | null | undefined): string {
  if (label && label.trim()) return label
  if (mos == null) return 'Tracking'
  if (mos <= 4) return 'Seller market'
  if (mos < 6) return 'Balanced'
  return 'Buyer market'
}

function healthToneClass(label: string | null | undefined, mos: number | null | undefined): string {
  const verdict = (label ?? formatHealth(label, mos)).toLowerCase()
  if (verdict.includes('hot') || verdict.includes('seller')) return 'bg-rose-500/20 text-rose-100'
  if (verdict.includes('warm') || verdict.includes('balanced')) return 'bg-amber-300/30 text-amber-50'
  if (verdict.includes('cool') || verdict.includes('buyer')) return 'bg-sky-300/30 text-sky-50'
  return 'bg-white/15 text-white'
}

export default function MarketSnapshotCard({ snapshot, scope = 'city' }: Props) {
  const healthLabel = formatHealth(snapshot.market_health_label, snapshot.months_of_supply)
  const detailHref = scope === 'region'
    ? '/housing-market'
    : `/housing-market/${encodeURIComponent(snapshot.geo_slug)}`

  return (
    <article className="overflow-hidden rounded-2xl border border-primary/10 bg-primary text-primary-foreground shadow-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 pb-5 pt-5">
        <div className="col-span-2 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/75">
              {scope === 'region' ? 'Central Oregon' : 'Market snapshot'}
            </p>
            <p className="font-display text-2xl text-primary-foreground sm:text-3xl">
              {snapshot.geo_label}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
              healthToneClass(snapshot.market_health_label, snapshot.months_of_supply)
            )}
          >
            {healthLabel}
          </span>
        </div>
        <Metric label="Median list" value={formatPriceShort(snapshot.median_list_price)} />
        <Metric
          label="Months of supply"
          value={formatMonths(snapshot.months_of_supply)}
        />
        <Metric
          label="Active listings"
          value={snapshot.active_count.toLocaleString('en-US')}
        />
        <Metric
          label="Sold (30 days)"
          value={snapshot.sold_count_30d.toLocaleString('en-US')}
        />
        <Metric
          label="New this week"
          value={snapshot.new_count_7d.toLocaleString('en-US')}
        />
        <Metric
          label="Median days on market"
          value={
            snapshot.median_active_dom != null
              ? `${Math.round(snapshot.median_active_dom)} days`
              : '—'
          }
        />
      </div>
      <Link
        href={detailHref}
        className="flex items-center justify-between border-t border-primary-foreground/15 bg-primary-foreground/5 px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary-foreground/10"
      >
        <span>See the full market report</span>
        <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
      </Link>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-primary-foreground/70">{label}</p>
      <p className="mt-0.5 font-display text-xl tabular-nums text-primary-foreground sm:text-2xl">
        {value}
      </p>
    </div>
  )
}
