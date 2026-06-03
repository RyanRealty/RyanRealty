import Link from 'next/link'
import { Eyebrow, H3, Stack } from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import { findSchoolByName } from '@/data/co-schools'
import type { ListingDetail } from '@/lib/data/types/listing'

/**
 * SchoolsBlock — three stat cards (Elementary / Middle / High) +
 * school-district subtitle on each card. Per docs/EXECUTION_PLAN.md
 * §8 Zillow Showcase parity (schools is table stakes).
 *
 * Spec source:
 *   design_system/ryan-realty/ui_kits/listing-detail/index.html §schools
 *
 * Reads from listing.elementarySchool / middleSchool / highSchool /
 * schoolDistrict. Renders nothing when no school data is present.
 */

type Props = {
  listing: Pick<
    ListingDetail,
    'elementarySchool' | 'middleSchool' | 'highSchool' | 'schoolDistrict'
  >
  className?: string
}

// MLS feeds often mask private-listing school + district fields with
// a `********` placeholder. Treat those as missing rather than rendering
// the asterisks as text.
function cleanField(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.startsWith('***')) return null
  return trimmed
}

export function SchoolsBlock({ listing, className }: Props) {
  const cards: Array<{ level: string; name: string | null }> = [
    { level: 'Elementary', name: cleanField(listing.elementarySchool) },
    { level: 'Middle', name: cleanField(listing.middleSchool) },
    { level: 'High', name: cleanField(listing.highSchool) },
  ]
  const district = cleanField(listing.schoolDistrict)
  const anyPresent = cards.some((c) => c.name && c.name.length > 0)
  if (!anyPresent && !district) return null

  return (
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>Schools</Eyebrow>
        <H3 className="mt-1.5">Schools and district</H3>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {cards.map((c) => (
          <SchoolCard
            key={c.level}
            level={c.level}
            name={c.name}
            district={district}
          />
        ))}
      </div>
    </Stack>
  )
}

function SchoolCard({
  level,
  name,
  district,
}: {
  level: string
  name: string | null
  district: string | null
}) {
  // Link the school name to its /schools/[slug] page when it exists in the
  // Central Oregon registry (slugify + lookup). Same card layout otherwise.
  const registered = name ? findSchoolByName(name) : undefined

  return (
    <div className={cn('rounded-[14px] border border-border bg-card p-4 shadow-sm')}>
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {level}
      </div>
      <div className="mt-1.5 text-[17px] font-bold tracking-[-0.01em] text-foreground">
        {name ? (
          registered ? (
            <Link
              href={`/schools/${registered.slug}`}
              className="text-primary transition-colors hover:text-primary/85 hover:underline"
            >
              {name}
            </Link>
          ) : (
            name
          )
        ) : (
          '—'
        )}
      </div>
      {district ? (
        <div className="mt-1 text-xs text-muted-foreground">{district}</div>
      ) : null}
    </div>
  )
}
