/**
 * Place-about related homes. Field of the matched city or community.
 * Count is the teaser on this page, not the place's full inventory.
 */
import { V3Field, V3SourceLine, type V3FieldItem } from '@/components/site/v3'
import type { PublishedBlogRelatedHomes } from '@/lib/blog/publish-blog-related-homes'

export function BlogRelatedHomes({ homes }: { homes: PublishedBlogRelatedHomes }) {
  const items: V3FieldItem[] = homes.items
  return (
    <>
      <p className="v3-heading v3-heading--field">{`Homes for sale in ${homes.place.label}`}</p>
      <V3Field
        id="related-homes"
        ariaLabel={`Homes for sale in ${homes.place.label}`}
        items={items}
        count={{
          value: String(items.length),
          label: 'shown here',
          source: homes.source,
        }}
      />
      <V3SourceLine source={homes.source} />
    </>
  )
}
