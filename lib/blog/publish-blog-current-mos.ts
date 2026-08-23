/**
 * Current months-of-supply figures inside blog HTML.
 *
 * Blog posts are CMS markup. A frozen "Central Oregon overall: 6.5" next to a
 * June series that ends at 6.0 is two current-looking numbers with no shared
 * SoR (fleet f3693aef8c4a8198e806a1b1b2d0b723). Current MOS on a blog page
 * must be the same pulse figure every other surface prints, gated through
 * publishMonthsOfSupply. Historical June snapshots stay as June snapshots.
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md: region = central-oregon, cities use
 * space-form slugs, Sunriver the resort community is geo_type=neighborhood.
 */
import { formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { marketVerdict } from '@/lib/market/classify'
import { publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'
import type { GeoType } from '@/lib/data/types/shared'

export type BlogCurrentMosPlace = {
  label: string
  geoType: GeoType
  geoSlug: string
}

export const BLOG_CURRENT_MOS_PLACES: readonly BlogCurrentMosPlace[] = [
  { label: 'Redmond', geoType: 'city', geoSlug: 'redmond' },
  { label: 'Bend', geoType: 'city', geoSlug: 'bend' },
  { label: 'Prineville', geoType: 'city', geoSlug: 'prineville' },
  { label: 'Sisters', geoType: 'city', geoSlug: 'sisters' },
  { label: 'La Pine', geoType: 'city', geoSlug: 'la pine' },
  { label: 'Madras', geoType: 'city', geoSlug: 'madras' },
  { label: 'Sunriver', geoType: 'neighborhood', geoSlug: 'sunriver' },
  { label: 'Central Oregon overall', geoType: 'region', geoSlug: 'central-oregon' },
]

export type BlogCurrentMosPulse = {
  monthsOfSupply: number | null
  activeCount: number | null
  refreshedAt: string | null
}

export type PublishedBlogMosRow = {
  label: string
  mos: number
  display: string
  verdict: string
}

export type PublishedBlogMos = {
  rows: PublishedBlogMosRow[]
  asOfLabel: string
  /**
   * Places whose figure was withheld this run. A frozen post carries a stale
   * claim per place ("Sunriver: 8.2 months, a buyer's market"), and the list is
   * regenerated from `rows`, so a withheld place vanishes from the list. Its
   * PROSE claim does not, and an unverifiable number surviving in a sentence is
   * the same section 0 violation as one in a table. The rewriter retires them.
   */
  withheldLabels: string[]
}

export function blogClaimsCurrentMos(html: string): boolean {
  if (!html.trim()) return false
  const hasMos = /months of supply/i.test(html)
  const hasCurrentList =
    /Central Oregon overall/i.test(html) ||
    /Where Central Oregon stands/i.test(html) ||
    /verified \w+ \d{1,2}, \d{4}/i.test(html)
  return hasMos && hasCurrentList
}

export function publishBlogCurrentMos(
  places: readonly BlogCurrentMosPlace[],
  pulses: Array<BlogCurrentMosPulse | null>,
): PublishedBlogMos | null {
  const rows: PublishedBlogMosRow[] = []
  const withheldLabels: string[] = []
  let asOf: string | null = null
  for (let i = 0; i < places.length; i += 1) {
    const place = places[i]
    const pulse = pulses[i]
    if (!place) continue
    if (!pulse) {
      withheldLabels.push(place.label)
      continue
    }
    const mos = publishMonthsOfSupply({
      // BLOG_CURRENT_MOS_PLACES carries the grain each row was read at. Sunriver
      // is a 'neighborhood' row and drops out of the table rather than printing
      // an absorption figure off a mismatched closed series.
      grain: place.geoType,
      pulseMos: pulse.monthsOfSupply,
      pulseActiveCount: pulse.activeCount,
      displayedActiveCount: pulse.activeCount,
    })
    if (mos == null) {
      withheldLabels.push(place.label)
      continue
    }
    if (!asOf && pulse.refreshedAt) asOf = pulse.refreshedAt
    const verdict = marketVerdict(mos)
    if (verdict.kind === 'unknown') {
      withheldLabels.push(place.label)
      continue
    }
    rows.push({
      label: place.label,
      mos,
      display: formatMonthsOfSupply(mos),
      verdict: verdict.label,
    })
  }
  if (rows.length === 0 || !asOf) return null
  return { rows, asOfLabel: formatDate(asOf), withheldLabels }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderCurrentList(published: PublishedBlogMos): string {
  const items = published.rows
    .map((row) => `<li><strong>${row.label}: ${row.display} months</strong>, a ${row.verdict}</li>`)
    .join('\n')
  return `<ul>\n${items}\n</ul>`
}

/**
 * Rewrite frozen current-MOS claims to the published pulse rows.
 * Leaves "X.X in 20XX" June-series snapshots untouched.
 */
export function rewriteBlogCurrentMos(html: string, published: PublishedBlogMos | null): string {
  if (!published) return html
  let next = html

  next = next.replace(
    /verified \w+ \d{1,2}, \d{4}/gi,
    `as of ${published.asOfLabel}`,
  )

  next = next.replace(
    /<ul>\s*(?:<li>[\s\S]*?<\/li>\s*)*<\/ul>/gi,
    (block) => (/Central Oregon overall/i.test(block) ? renderCurrentList(published) : block),
  )

  for (const row of published.rows) {
    const label = escapeRegExp(row.label)
    next = next.replace(
      new RegExp(`(<strong>${label}:\\s*)\\d+(?:\\.\\d+)?(\\s*months</strong>)`, 'gi'),
      `$1${row.display}$2`,
    )
    next = next.replace(
      new RegExp(`(\\b${label} at )\\d+(?:\\.\\d+)?(?!\\s+in\\s+20)`, 'gi'),
      `$1${row.display}`,
    )
  }

  // Retire the prose claims of every withheld place. The sentence is DELETED,
  // not repointed at another number: there is no verified figure for that place
  // this run, and section 0 rule 7 takes fewer sentences over one wrong one.
  for (const label of published.withheldLabels) {
    const escaped = escapeRegExp(label)
    next = next.replace(
      new RegExp(`(?:^|(?<=[.!?]\\s))[^.!?<>]*\\b${escaped} at \\d+(?:\\.\\d+)?[^.!?]*[.!?]\\s*`, 'gi'),
      '',
    )
    next = next.replace(
      new RegExp(`\\s*<li><strong>${escaped}:[^<]*</strong>[^<]*</li>`, 'gi'),
      '',
    )
  }

  const values = published.rows.map((row) => Number(row.display))
  if (values.length >= 2) {
    const min = Math.min(...values).toFixed(1)
    const max = Math.max(...values).toFixed(1)
    next = next.replace(
      /readings from \d+(?:\.\d+)? to \d+(?:\.\d+)?/gi,
      `readings from ${min} to ${max}`,
    )
  }

  return next
}
