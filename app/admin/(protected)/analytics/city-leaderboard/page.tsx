// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/analytics/city-leaderboard — city MLS-text detached ranks from
 * Market Truth (market_metric mt-v1). Not office share (D9).
 */
import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { SectionHead } from '@/components/admin/v2'
import {
  getCityLeaderboard,
  type LeaderboardRow,
} from '@/lib/data/market-truth/leaderboards'
import { STAT_BY_ID } from '@/lib/data/market-truth/registry'
import { formatPriceExact } from '@/lib/format/money'
import { DataList, Loading, Trouble } from '../_components/v2/kit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LIMIT = 16
const SEGMENT = 'detached'

function cityLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatSignedPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—'
  const pct = ratio * 100
  const abs = Math.abs(pct).toFixed(1)
  if (pct === 0) return '0.0%'
  return `${pct < 0 ? '\u2212' : '+'}${abs}%`
}

function formatSharePct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—'
  return `${(ratio * 100).toFixed(1)}%`
}

function formatDays(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const shown = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return `${shown} days`
}

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${new Intl.NumberFormat('en-US').format(Math.round(n))} listings`
}

function formatWindow(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return 'point'
  return `${months} mo`
}

function emptyCopy(statId: string, label: string) {
  const minN = STAT_BY_ID.get(statId)?.minN
  const floor = minN == null ? 'the registry min_n' : String(minN)
  return (
    <>
      No publishable detached city cells for {label} yet. Market Truth writes
      these ranks to <code>market_metric</code> (mt-v1) only when sample_n meets
      the registry min_n of {floor}. The board fills when those cells exist — a
      miss is not zero.
    </>
  )
}

function RankBoard({
  title,
  note,
  label,
  rows,
  valueHeader,
  formatValue,
  empty,
}: {
  title: string
  note: string
  label: string
  rows: LeaderboardRow[]
  valueHeader: string
  formatValue: (value: number) => string
  empty: ReactNode
}) {
  return (
    <section aria-label={label}>
      <SectionHead>{title}</SectionHead>
      <p className="av2-note">{note}</p>
      <DataList
        label={label}
        rows={rows}
        cap={LIMIT}
        rowKey={(r) => r.geoSlug}
        columns={[
          {
            key: 'city',
            header: 'City',
            lead: true,
            cell: (r) => (
              <Link href={`/cities/${r.geoSlug}`} style={{ color: 'var(--a-accent)' }}>
                {cityLabel(r.geoSlug) || r.geoSlug}
              </Link>
            ),
          },
          {
            key: 'rank',
            header: 'Rank',
            num: true,
            cell: (_r, i) => `#${i + 1}`,
          },
          {
            key: 'value',
            header: valueHeader,
            num: true,
            cell: (r) => formatValue(r.value),
          },
          {
            key: 'n',
            header: 'Sample n',
            num: true,
            cell: (r) => String(r.sampleN),
          },
          {
            key: 'window',
            header: 'Window',
            num: true,
            cell: (r) => formatWindow(r.windowMonths),
          },
        ]}
        empty={empty}
      />
    </section>
  )
}

async function CityBoards() {
  let yoyGain: LeaderboardRow[]
  let yoyDrop: LeaderboardRow[]
  let expensive: LeaderboardRow[]
  let fastest: LeaderboardRow[]
  let priceCuts: LeaderboardRow[]
  let newInventory: LeaderboardRow[]
  try {
    ;[yoyGain, yoyDrop, expensive, fastest, priceCuts, newInventory] = await Promise.all([
      getCityLeaderboard({ stat: 'yoy_median_price', segment: SEGMENT, limit: LIMIT }),
      getCityLeaderboard({
        stat: 'yoy_median_price',
        segment: SEGMENT,
        limit: LIMIT,
        ascending: true,
      }),
      getCityLeaderboard({ stat: 'median_list_active', segment: SEGMENT, limit: LIMIT }),
      getCityLeaderboard({
        stat: 'median_days_to_contract',
        segment: SEGMENT,
        limit: LIMIT,
        ascending: true,
      }),
      getCityLeaderboard({ stat: 'pct_with_price_cut', segment: SEGMENT, limit: LIMIT }),
      getCityLeaderboard({ stat: 'new_listings', segment: SEGMENT, limit: LIMIT }),
    ])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return (
      <Trouble>
        Could not load city ranks: {message}. Nothing on this page is trustworthy
        until the <code>market_metric</code> read succeeds.
      </Trouble>
    )
  }

  return (
    <>
      <RankBoard
        title="YoY median price — largest gain"
        note="Ranked by year-over-year median close, largest gain first. Value is the ratio (now / year-ago − 1)."
        label="YoY median price largest gain"
        rows={yoyGain}
        valueHeader="YoY"
        formatValue={formatSignedPct}
        empty={emptyCopy('yoy_median_price', 'YoY median price (gain)')}
      />
      <RankBoard
        title="YoY median price — largest decline"
        note="Same stat, inverted: biggest drop first. A miss is not 0%."
        label="YoY median price largest decline"
        rows={yoyDrop}
        valueHeader="YoY"
        formatValue={formatSignedPct}
        empty={emptyCopy('yoy_median_price', 'YoY median price (decline)')}
      />
      <RankBoard
        title="Most expensive"
        note="Active detached median list price, highest first."
        label="Most expensive cities by median list"
        rows={expensive}
        valueHeader="Median list"
        formatValue={formatPriceExact}
        empty={emptyCopy('median_list_active', 'median list (active)')}
      />
      <RankBoard
        title="Fastest to contract"
        note="Median days to contract, lowest first. This is days to contract, never days on market."
        label="Fastest to contract"
        rows={fastest}
        valueHeader="Days to contract"
        formatValue={formatDays}
        empty={emptyCopy('median_days_to_contract', 'days to contract')}
      />
      <RankBoard
        title="Most price cuts"
        note="Share of closed sales where original list was above final list, highest first."
        label="Most price cuts"
        rows={priceCuts}
        valueHeader="Price-cut share"
        formatValue={formatSharePct}
        empty={emptyCopy('pct_with_price_cut', 'price-cut share')}
      />
      <RankBoard
        title="Most new inventory"
        note="New listings in the window, highest first."
        label="Most new inventory"
        rows={newInventory}
        valueHeader="New listings"
        formatValue={formatCount}
        empty={emptyCopy('new_listings', 'new listings')}
      />
    </>
  )
}

export default function CityLeaderboardPage() {
  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <p className="av2-note">
        These are city MLS-text detached ranks from Market Truth (
        <code>market_metric</code> mt-v1, registry min_n), not office share.
        Sample n and window months are the cell&apos;s provenance. City names
        open the public city page.
      </p>
      <Suspense fallback={<Loading what="city ranks" />}>
        <CityBoards />
      </Suspense>
    </div>
  )
}
