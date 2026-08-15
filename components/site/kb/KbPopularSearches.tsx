import Link from 'next/link'

/**
 * KB Popular searches — the lifestyle-collection link rail.
 *
 * conversion-audit 2026-07-15 #12: GSC showed "bend golf course homes", "bend
 * gated community homes", and "bend buildable lots" ranking the CITY page at
 * position 36-55 because nothing on the site linked the dedicated preset pages.
 * One exact-match anchor per measured query class, pointing at the preset that
 * actually answers it.
 *
 * Lives here, not inline in the page, because the KB sections are the single
 * source of truth (ci:kb-single-source G50) — a second place page that needs the
 * same rail reuses this instead of forking the markup.
 */
export function KbPopularSearches({ citySlug, cityName }: { citySlug: string; cityName: string }) {
  return (
    <section className="section kb-collections" aria-label={`Browse ${cityName} homes by lifestyle`}>
      <div className="wrap">
        <span className="sec-index">{cityName} · Popular searches</span>
        <div className="kb-collection-links">
          <a href={`/homes-for-sale/${citySlug}/on-golf-course`} className="btn alt">{cityName} golf course homes</a>
          <a href={`/homes-for-sale/${citySlug}/gated-community`} className="btn alt">{cityName} gated community homes</a>
          <a href={`/homes-for-sale/${citySlug}/lots-and-land`} className="btn alt">{cityName} lots and land</a>
          <a href={`/homes-for-sale/${citySlug}/acreage`} className="btn alt">{cityName} homes on acreage</a>
          <a href={`/homes-for-sale/${citySlug}/new-construction`} className="btn alt">{cityName} new construction</a>
          <Link href="/communities" className="btn alt">Resort communities</Link>
        </div>
      </div>
    </section>
  )
}
