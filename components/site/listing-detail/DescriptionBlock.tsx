import { cn } from '@/lib/utils'

/**
 * Listing-detail DescriptionBlock — renders the listing's public_remarks
 * in the KB (kinetic-brutalist) section style: navy border-bottom sec-head,
 * eyebrow mono label, cream/navy surface.
 *
 * Per CLAUDE.md §0.5 brand voice: public_remarks IS user-facing prose. The
 * remarks come from the MLS; the block renders them as-is.
 */

type Props = {
  publicRemarks: string | null
  className?: string
}

export function DescriptionBlock({ publicRemarks, className }: Props) {
  if (!publicRemarks || publicRemarks.trim().length === 0) return null

  const paragraphs = publicRemarks
    .split(/\n{2,}|\r\n\r\n|\r{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  return (
    <section className={cn('section', className)}>
      {/* KB sec-head */}
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">About this home</div>
          <h2 className="sec-title display">Description</h2>
        </div>
      </div>

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
              color: 'rgba(16,39,66,0.78)',
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
