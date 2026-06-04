import Link from 'next/link'
import Image from 'next/image'
import type { MegaMenuCommunities, MegaMenuCommunity } from '@/lib/data'
import { Price, TabularNumber } from '@/components/site/primitives'
import { Tile, PanelHeading } from './megaShared'

/**
 * CommunitiesBento — the Communities panel. One featured PHOTO tile (the first
 * community that has a verified image) plus a grid of community link tiles, each
 * with a null-guarded active count + median. The photo tile uses next/image over
 * a bg-primary fallback with a navy scrim so the white label stays legible.
 */

function CommunityStatLine({ community }: { community: MegaMenuCommunity }) {
  if (community.activeCount == null && community.medianListPrice == null) return null
  return (
    <p className="mt-1 text-xs leading-[1.5] tabular-nums text-muted-foreground">
      {community.activeCount != null && (
        <>
          <TabularNumber value={community.activeCount} /> active
        </>
      )}
      {community.activeCount != null && community.medianListPrice != null && ' · '}
      {community.medianListPrice != null && (
        <>
          <Price value={community.medianListPrice} compact /> median
        </>
      )}
    </p>
  )
}

export function CommunitiesBento({ data }: { data: MegaMenuCommunities }) {
  const featured = data.communities.find((c) => c.imageSrc) ?? data.communities[0]
  const rest = data.communities.filter((c) => c.slug !== featured?.slug)

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Featured photo tile */}
      {featured && (
        <Link
          href={featured.href}
          className="group/photo relative col-span-1 flex min-h-48 flex-col justify-end overflow-hidden rounded-xl bg-primary p-5 lg:col-span-4"
        >
          {featured.imageSrc && (
            <Image
              src={featured.imageSrc}
              alt={featured.name}
              fill
              sizes="(min-width: 1024px) 24rem, 100vw"
              className="object-cover opacity-80 transition duration-300 group-hover/photo:opacity-90"
            />
          )}
          {/* Navy scrim layer so the white label reads over the photo */}
          <div
            aria-hidden
            className="absolute inset-0 bg-primary/55"
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground/80">
              Featured community
            </p>
            <p className="mt-1 font-display text-2xl leading-none tracking-[-0.01em] text-primary-foreground">
              {featured.name}
            </p>
            {(featured.activeCount != null || featured.medianListPrice != null) && (
              <p className="mt-2 text-[13px] tabular-nums text-primary-foreground/90">
                {featured.activeCount != null && (
                  <>
                    <TabularNumber value={featured.activeCount} /> active
                  </>
                )}
                {featured.activeCount != null && featured.medianListPrice != null && ' · '}
                {featured.medianListPrice != null && (
                  <>
                    <Price value={featured.medianListPrice} compact /> median
                  </>
                )}
              </p>
            )}
          </div>
        </Link>
      )}

      {/* Community tiles */}
      <div className="grid grid-cols-2 gap-5 lg:col-span-8 lg:grid-cols-3">
        {rest.map((community) => (
          <Tile key={community.slug} className="p-4">
            <Link
              href={community.href}
              className="block truncate font-display text-sm font-semibold tracking-[-0.01em] text-primary transition hover:text-primary/80"
            >
              {community.name}
            </Link>
            <CommunityStatLine community={community} />
          </Tile>
        ))}
      </div>

      <div className="lg:col-span-12">
        <PanelHeading>
          <Link href="/communities" className="transition hover:text-primary/80">
            View all communities &rarr;
          </Link>
        </PanelHeading>
      </div>
    </div>
  )
}
