import type { CityContent } from '@/lib/city-content'
import GeoAboutSection, { type QuickFact } from '@/components/geo-page/GeoAboutSection'

type QuickFacts = {
  population?: string | null
  elevation?: string | null
  county?: string | null
  schoolDistrict?: string | null
  priceRangeMin?: number | null
  priceRangeMax?: number | null
  avgLotSize?: string | null
  nearestAirport?: string | null
}

type Props = {
  cityName: string
  description: string | null
  quickFacts: QuickFacts
  cityContent?: CityContent | null
  dataDrivenParagraphs?: string[]
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function toQuickFactsList(q: QuickFacts): QuickFact[] {
  const list: QuickFact[] = []
  if (q.population) list.push({ label: 'Population', value: q.population })
  if (q.elevation) list.push({ label: 'Elevation', value: q.elevation })
  if (q.county) list.push({ label: 'County', value: q.county })
  if (q.schoolDistrict) list.push({ label: 'School district', value: q.schoolDistrict })
  if (q.priceRangeMin != null || q.priceRangeMax != null) {
    const val =
      q.priceRangeMin != null && q.priceRangeMax != null
        ? `${formatPrice(q.priceRangeMin)} – ${formatPrice(q.priceRangeMax)}`
        : q.priceRangeMin != null
          ? formatPrice(q.priceRangeMin) + '+'
          : q.priceRangeMax != null
            ? formatPrice(q.priceRangeMax)
            : '—'
    list.push({ label: 'Price range', value: val })
  }
  if (q.avgLotSize) list.push({ label: 'Avg lot size', value: q.avgLotSize })
  if (q.nearestAirport) list.push({ label: 'Nearest airport', value: q.nearestAirport })
  return list
}

function renderParagraphs(paragraphs: string[]) {
  return (
    <div className="prose prose-primary max-w-none">
      {paragraphs.map((p, i) => (
        <p key={i} className="mt-3 first:mt-0">
          {p.trim()}
        </p>
      ))}
    </div>
  )
}

export default function CityOverview({ cityName, description, quickFacts, cityContent, dataDrivenParagraphs }: Props) {
  const hasStoredDescription = description && description.trim().length >= 180
  const useStoredDescription = hasStoredDescription && !cityContent
  const fallbackParagraphs = dataDrivenParagraphs && dataDrivenParagraphs.length > 0 ? dataDrivenParagraphs : null

  const content =
    cityContent ? (
      <>
        {renderParagraphs([cityContent.description])}
        {cityContent.history && (
          <>
            <h3 className="mt-5 text-base font-semibold text-primary">History &amp; character</h3>
            {renderParagraphs([cityContent.history])}
          </>
        )}
        {cityContent.demographics && (
          <>
            <h3 className="mt-5 text-base font-semibold text-primary">Community &amp; demographics</h3>
            {renderParagraphs([cityContent.demographics])}
          </>
        )}
        {cityContent.attractions && (
          <>
            <h3 className="mt-5 text-base font-semibold text-primary">Things to do</h3>
            {renderParagraphs([cityContent.attractions])}
          </>
        )}
        {cityContent.dining && (
          <>
            <h3 className="mt-5 text-base font-semibold text-primary">Dining &amp; food</h3>
            {renderParagraphs([cityContent.dining])}
          </>
        )}
      </>
    ) : useStoredDescription ? (
      <div className="prose max-w-none">
        {description!.split(/\n\n+/).map((p, i) => (
          <p key={i} className="mt-3 first:mt-0">
            {p.trim()}
          </p>
        ))}
      </div>
    ) : fallbackParagraphs ? (
      renderParagraphs(fallbackParagraphs)
    ) : (
      <p>
        {cityName} is one of Central Oregon&apos;s communities. Browse active listings below to find your next home and explore neighborhoods and market stats on this page.
      </p>
    )

  return (
    <GeoAboutSection
      placeName={cityName}
      headingId="city-overview-heading"
      quickFacts={toQuickFactsList(quickFacts)}
    >
      {content}
    </GeoAboutSection>
  )
}
