import { publishListingRemarks } from '@/lib/listing/publish-listing-remarks'
import { cn } from '@/lib/utils'
import type { ListingFace } from '@/lib/listing/listing-face'
import { ListingSectionHead } from './ListingSectionHead'

/**
 * Listing-detail DescriptionBlock — renders the listing's public_remarks
 * in the KB (kinetic-brutalist) section style: navy border-bottom sec-head,
 * eyebrow mono label, cream/navy surface.
 *
 * Per CLAUDE.md §0.5 brand voice: public_remarks IS user-facing prose. The
 * remarks come from the MLS. Mid-sentence blank-line splits are joined by
 * publishListingRemarks; words are never invented.
 */

type Props = {
  publicRemarks: string | null
  className?: string
  heading?: string | false
  face?: ListingFace
}

export function DescriptionBlock({ publicRemarks, className, heading = false, face = 'house' }: Props) {
  const paragraphs = publishListingRemarks(publicRemarks)
  if (paragraphs.length === 0) return null

  return (
    <section className={cn('section', className)}>
      <ListingSectionHead heading={heading} eyebrow={face === 'land' ? 'About this lot' : 'About this home'} />

      <div
        style={{
          paddingTop: 'clamp(22px,3vw,36px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: '68ch',
        }}
      >
        {paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              fontSize: 'clamp(0.95rem,1.8vw,1.08rem)',
              lineHeight: 1.65,
              color: 'color-mix(in srgb, var(--v3-navy) 78%, transparent)',
              fontWeight: 400,
            }}
          >
            {p}
          </p>
        ))}
      </div>
    </section>
  )
}
