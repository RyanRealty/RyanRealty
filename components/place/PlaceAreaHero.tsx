import '@/components/place/place-opening.css'

/** Place still. With `.place-opening--media` it is the fold, not a strip under cream type. Miss omits. */
export function PlaceAreaHero({ posterSrc }: { posterSrc: string | null | undefined }) {
  if (!posterSrc) return null
  return (
    <div className="place-opening__media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={posterSrc} alt="" decoding="async" fetchPriority="high" />
    </div>
  )
}
