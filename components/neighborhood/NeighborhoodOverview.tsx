import Link from 'next/link'
import GeoAboutSection, { type QuickFact } from '@/components/geo-page/GeoAboutSection'

type Props = {
  neighborhoodName: string
  cityName: string
  citySlug: string
  description: string | null
  dataDrivenParagraphs?: string[]
  /** Optional: active count and price range for Quick facts. */
  activeCount?: number
  medianPrice?: number | null
  priceRangeMin?: number | null
  priceRangeMax?: number | null
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function NeighborhoodOverview({
  neighborhoodName,
  cityName,
  citySlug,
  description,
  dataDrivenParagraphs,
  activeCount = 0,
  medianPrice,
  priceRangeMin,
  priceRangeMax,
}: Props) {
  const hasStoredDescription = description && description.trim().length >= 180
  const fallbackParagraphs = dataDrivenParagraphs && dataDrivenParagraphs.length > 0 ? dataDrivenParagraphs : null

  const quickFacts: QuickFact[] = []
  if (activeCount > 0) quickFacts.push({ label: 'Active listings', value: String(activeCount) })
  if (medianPrice != null && medianPrice > 0) quickFacts.push({ label: 'Median price', value: formatPrice(medianPrice) })
  if (priceRangeMin != null || priceRangeMax != null) {
    const val =
      priceRangeMin != null && priceRangeMax != null
        ? `${formatPrice(priceRangeMin)} – ${formatPrice(priceRangeMax)}`
        : priceRangeMin != null
          ? formatPrice(priceRangeMin) + '+'
          : priceRangeMax != null
            ? formatPrice(priceRangeMax)
            : '—'
    quickFacts.push({ label: 'Price range', value: val })
  }

  const content = (
    <>
      {hasStoredDescription ? (
        <div className="prose max-w-none">
          {description!.split(/\n\n+/).map((p, i) => (
            <p key={i} className="mt-3 first:mt-0">
              {p.trim()}
            </p>
          ))}
        </div>
      ) : fallbackParagraphs ? (
        <div className="prose max-w-none">
          {fallbackParagraphs.map((p, i) => (
            <p key={i} className="mt-3 first:mt-0">
              {p.trim()}
            </p>
          ))}
        </div>
      ) : (
        <p>
          {neighborhoodName} is a neighborhood in {cityName}, Oregon. Browse active listings below and visit the {cityName} city page for area-wide market stats and communities.
        </p>
      )}
      <p className="mt-5">
        <Link href={`/cities/${citySlug}`} className="font-medium text-accent-foreground hover:text-accent-foreground">
          ← Back to {cityName}
        </Link>
      </p>
    </>
  )

  return (
    <GeoAboutSection
      placeName={neighborhoodName}
      headingId="neighborhood-overview-heading"
      quickFacts={quickFacts}
    >
      {content}
    </GeoAboutSection>
  )
}
