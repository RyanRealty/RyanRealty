import Link from 'next/link'

type Props = {
  neighborhoodName: string
  cityName: string
  citySlug: string
  description: string | null
}

export default function NeighborhoodOverview({
  neighborhoodName,
  cityName,
  citySlug,
  description,
}: Props) {
  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="neighborhood-overview-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="neighborhood-overview-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          About {neighborhoodName}
        </h2>
        {description ? (
          <div className="mt-4 prose prose-[var(--brand-navy)] max-w-none">
            {description.split(/\n\n+/).map((p, i) => (
              <p key={i} className="mt-3 text-[var(--text-secondary)]">
                {p.trim()}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[var(--text-secondary)]">
            {neighborhoodName} is a neighborhood in {cityName}. Browse active listings below.
          </p>
        )}
        <p className="mt-6">
          <Link href={`/cities/${citySlug}`} className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
            ← Back to {cityName}
          </Link>
        </p>
      </div>
    </section>
  )
}
