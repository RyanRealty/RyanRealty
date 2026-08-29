import { V3Breadcrumb, V3Stage, type V3Crumb } from '@/components/site/v3'

/** Full-bleed place Stage when we have an owned still. Headline is the H1. */
export function PlaceAreaHero({
  eyebrow,
  headline,
  posterSrc,
  actionLabel,
  trail,
}: {
  eyebrow: string
  headline: string
  posterSrc: string | null | undefined
  actionLabel: string
  trail: readonly V3Crumb[]
}) {
  if (!posterSrc) return null
  return (
    <>
      <V3Breadcrumb tone="on-media" trail={trail} />
      <V3Stage
        id="place"
        headingLevel={1}
        height="tall"
        eyebrow={eyebrow}
        headline={headline}
        posterSrc={posterSrc}
        action={{ label: actionLabel, href: '#homes' }}
      />
    </>
  )
}
