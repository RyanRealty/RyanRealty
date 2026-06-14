import Image from 'next/image'
import Link from 'next/link'
import {
  Container,
  Eyebrow,
  Grid,
  H2,
  Section,
  TabularNumber,
} from '@/components/site/primitives'

/**
 * Site v2 related-areas grid — 4 to 8 cards linking to sibling
 * cities / communities / zip codes from a city or community page. Per
 * plan §9 Layer 3.
 *
 * For internal cross-navigation between geo pages so a viewer landing
 * on /cities/bend can hop to /cities/redmond or /communities/tetherow
 * without backtracking to the index page.
 *
 * Active count is rendered through TabularNumber so the figure aligns
 * across cards. The whole card is a click target; arrow on the right
 * mirrors the CityGrid pattern.
 *
 * Example:
 *   <RelatedAreas
 *     title="Nearby cities"
 *     items={[
 *       { name: 'Redmond', href: '/cities/redmond', activeCount: 241 },
 *       { name: 'Sisters', href: '/cities/sisters', activeCount: 96 },
 *       { name: 'Sunriver', href: '/cities/sunriver', activeCount: 64 },
 *     ]}
 *   />
 */

export type RelatedAreaItem = {
  name: string
  href: string
  /** Optional active-listing count rendered as "N active" under the name. */
  activeCount?: number | null
  /**
   * Optional tile photo. When ANY item in the grid has one, the grid renders
   * as photo cards (image + name/count overlaid on a navy scrim). Source it
   * from the canonical stores: asset_library (getGeoTileImages) for cities /
   * neighborhoods, GOLF_COMMUNITY_IMAGES (lib/geo-images) for golf communities.
   */
  imageUrl?: string | null
}

type Props = {
  items: ReadonlyArray<RelatedAreaItem>
  title?: string
  eyebrow?: string
  /** Section tone — default light bg; pass "muted" for the cream surface. */
  tone?: 'default' | 'muted'
  /** Grid columns at the largest breakpoint. */
  cols?: 2 | 3 | 4
  /**
   * Optional "view all" link rendered to the right of the title — use when the
   * grid is a capped subset (e.g. the 6 main golf/master-planned communities,
   * with the full set at /communities).
   */
  viewAllHref?: string
  viewAllLabel?: string
  className?: string
}

/** Compact text row — used when no item in the grid has a photo. */
function AreaTextTile({ item }: { item: RelatedAreaItem }) {
  return (
    <Link
      href={item.href}
      className="group bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-3 shadow-sm hover:border-primary/40 hover:shadow-md transition"
    >
      <div className="min-w-0">
        <div className="text-sm font-bold tracking-tight text-foreground truncate">
          {item.name}
        </div>
        {typeof item.activeCount === 'number' ? (
          <div className="text-xs text-muted-foreground mt-0.5">
            <TabularNumber value={item.activeCount} /> active
          </div>
        ) : null}
      </div>
      <span
        aria-hidden
        className="text-muted-foreground group-hover:text-primary transition shrink-0"
      >
        →
      </span>
    </Link>
  )
}

/** Photo card — image with a navy bottom-up scrim and the name/count overlaid.
 * Items missing a photo fall back to a solid navy card so the grid stays
 * uniform (never a stark white box). */
function AreaPhotoTile({ item }: { item: RelatedAreaItem }) {
  return (
    <Link
      href={item.href}
      className="group relative block aspect-[4/3] overflow-hidden rounded-xl border border-border shadow-sm hover:shadow-md transition"
    >
      {item.imageUrl ? (
        <>
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-primary via-primary/30 to-transparent"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="text-sm font-bold tracking-tight text-white drop-shadow">{item.name}</div>
            {typeof item.activeCount === 'number' ? (
              <div className="text-xs text-white/85 mt-0.5">
                <TabularNumber value={item.activeCount} /> active
              </div>
            ) : null}
          </div>
        </>
      ) : (
        // No photo: a designed navy nameplate (centered display type) instead of
        // a stark empty block, so photoless cards read as intentional.
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary to-[rgba(16,39,66,0.85)] px-4 text-center">
          <div className="font-display text-lg leading-tight text-white drop-shadow">{item.name}</div>
          {typeof item.activeCount === 'number' ? (
            <div className="mt-1.5 text-xs text-white/75">
              <TabularNumber value={item.activeCount} /> active
            </div>
          ) : null}
        </div>
      )}
    </Link>
  )
}

export function RelatedAreas({
  items,
  title = 'Related areas',
  eyebrow,
  tone = 'muted',
  cols = 4,
  viewAllHref,
  viewAllLabel = 'View all',
  className,
}: Props) {
  if (items.length === 0) return null

  // If any item carries a photo, render the whole grid as photo cards so it
  // reads as one consistent set (D86). Otherwise keep the compact text rows.
  const hasImages = items.some((i) => i.imageUrl)

  return (
    <Section padding="default" tone={tone} divider className={className}>
      <Container>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="flex flex-col items-start gap-2">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <H2>{title}</H2>
          </div>
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {viewAllLabel}
            </Link>
          ) : null}
        </div>

        <Grid cols={cols} gap="default">
          {items.map((item) =>
            hasImages ? (
              <AreaPhotoTile key={item.href} item={item} />
            ) : (
              <AreaTextTile key={item.href} item={item} />
            ),
          )}
        </Grid>
      </Container>
    </Section>
  )
}
