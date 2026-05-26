import Link from 'next/link'
import { getCitiesForIndex } from '@/app/actions/cities'

/**
 * Site v2 city grid — 8 city cards with median + active count + DOM-style stats line.
 * Mirrors design_system/ryan-realty/ui_kits/website/index.html §cities.
 *
 * Data accuracy: every figure traces to geo_snapshot_mv via getCitiesForIndex().
 * Unavailable values render as em-dash per brand voice.
 */

// 8 mockup-aligned cities. Order matches market relevance for Central Oregon.
const CITY_ORDER = [
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
  'prineville',
  'terrebonne',
] as const

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function fmtMoneyRound1k(n: number | null): string {
  if (n == null) return '—'
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

export default async function CityGrid() {
  const cities = await getCitiesForIndex().catch(() => [])
  const bySlug = new Map(cities.map((c) => [c.slug, c]))
  const ordered = CITY_ORDER.map((slug) => bySlug.get(slug)).filter(
    (c): c is NonNullable<typeof c> => c != null,
  )

  // If geo_snapshot_mv is empty for some reason, fall back to whatever we got.
  const shown = ordered.length > 0 ? ordered : cities.slice(0, 8)

  if (shown.length === 0) {
    return null
  }

  return (
    <section className="py-14 bg-muted border-y border-border">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-6">
          <div className="rr-eyebrow">Communities</div>
          <h2 className="mt-1.5 text-[clamp(1.5rem,2vw+0.5rem,1.875rem)] font-bold tracking-[-0.01em] text-foreground">
            Search by city
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Eleven Central Oregon communities. Median prices refreshed daily.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((c) => (
            <Link
              key={c.slug}
              href={`/cities/${c.slug}`}
              className="group bg-card border border-border rounded-[14px] p-[18px] flex flex-col gap-1.5 shadow-sm hover:border-primary/30 hover:shadow-md transition"
            >
              <div className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.01em] text-foreground">
                <span className="text-primary"><PinIcon /></span>
                {c.name}
              </div>
              <div className="text-[15px] font-semibold tabular-nums text-foreground mt-0.5">
                {fmtMoneyRound1k(c.medianPrice)}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {c.activeCount > 0 ? `${c.activeCount.toLocaleString()} active` : 'No active listings'}
                {c.communityCount > 0 ? ` · ${c.communityCount} communities` : ''}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
