import '@/components/place/place-opening.css'

/** Place still, full-bleed under the opener type. Not an H1 cage. Miss omits. */
export function PlaceAreaHero({ posterSrc }: { posterSrc: string | null | undefined }) {
  if (!posterSrc) return null
  return (
    <div className="place-opening__media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={posterSrc} alt="" decoding="async" fetchPriority="high" />
    </div>
  )
}
