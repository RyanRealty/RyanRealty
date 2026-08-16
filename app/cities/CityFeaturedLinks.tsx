type CityFeaturedLinksProps = {
  slug: string
  name: string
}

const linkClass = 'underline-offset-4 hover:underline'
const linkStyle = { color: 'var(--navy)' } as const

/** Guide / inventory / open-house links; Bend also points at /luxury-homes-bend. */
export function CityFeaturedLinks({ slug, name }: CityFeaturedLinksProps) {
  return (
    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
      <a href={`/cities/${slug}`} className={linkClass} style={linkStyle}>
        {name} guide
      </a>
      <a href={`/homes-for-sale/${slug}`} className={linkClass} style={linkStyle}>
        Homes for sale
      </a>
      <a href={`/open-houses/${slug}`} className={linkClass} style={linkStyle}>
        Open houses
      </a>
      {slug === 'bend' ? (
        <a href="/luxury-homes-bend" className={linkClass} style={linkStyle}>
          Luxury homes
        </a>
      ) : null}
    </div>
  )
}
