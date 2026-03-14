import type { ListingRow } from '@/app/actions/communities'
import type { ResortCommunityContent } from '@/lib/community-content'
import GeoAboutSection, { type QuickFact } from '@/components/geo-page/GeoAboutSection'

type ResortContent = Record<string, unknown>

type Props = {
  description: string | null
  isResort: boolean
  resortContent: ResortContent | null
  communityName: string
  city: string
  listings: ListingRow[]
  resortStaticContent?: ResortCommunityContent | null
  dataDrivenParagraphs?: string[]
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function renderParagraphs(paragraphs: string[]) {
  return (
    <div className="prose max-w-none">
      {paragraphs.map((p, i) => (
        <p key={i} className="mt-3 first:mt-0">
          {p.trim()}
        </p>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-base font-semibold text-primary">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  )
}

export default function CommunityOverview({
  description,
  isResort,
  resortContent,
  communityName,
  city,
  listings,
  resortStaticContent,
  dataDrivenParagraphs,
}: Props) {
  const prices = listings
    .map((l) => l.ListPrice)
    .filter((p): p is number => p != null && Number.isFinite(p) && p > 0)
  const minPrice = prices.length > 0 ? Math.min(...prices) : null
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null
  const propertyTypes = Array.from(
    new Set(listings.map((l) => (l as { PropertyType?: string }).PropertyType).filter(Boolean))
  ) as string[]
  const lotSizes = listings
    .map((l) => (l as { LotSizeAcres?: number; LotSizeSqFt?: number }).LotSizeAcres ?? (l as { LotSizeSqFt?: number }).LotSizeSqFt)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  const avgLot = lotSizes.length > 0 ? lotSizes.reduce((a, b) => a + b, 0) / lotSizes.length : null
  const years = listings
    .map((l) => (l as { YearBuilt?: number }).YearBuilt)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  const yearRange = years.length > 0 ? { min: Math.min(...years), max: Math.max(...years) } : null
  const hasHoa = listings.some((l) => (l as { AssociationYN?: boolean }).AssociationYN === true)
  const waterfront = listings.some((l) => (l as { WaterfrontYN?: boolean }).WaterfrontYN === true)

  const quickFacts: QuickFact[] = []
  if (propertyTypes.length > 0) quickFacts.push({ label: 'Property types', value: propertyTypes.slice(0, 5).join(', ') })
  if (minPrice != null || maxPrice != null) {
    const val =
      minPrice != null && maxPrice != null
        ? `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`
        : minPrice != null
          ? formatPrice(minPrice) + '+'
          : formatPrice(maxPrice!)
    quickFacts.push({ label: 'Price range', value: val })
  }
  if (avgLot != null)
    quickFacts.push({
      label: 'Avg lot size',
      value: avgLot >= 1 ? `${avgLot.toFixed(1)} ac` : `${(avgLot * 43560).toFixed(0)} sq ft`,
    })
  if (yearRange)
    quickFacts.push({
      label: 'Year built',
      value: yearRange.min === yearRange.max ? String(yearRange.min) : `${yearRange.min} – ${yearRange.max}`,
    })
  quickFacts.push({ label: 'HOA', value: hasHoa ? 'Yes' : 'No' })
  quickFacts.push({ label: 'Waterfront', value: waterfront ? 'Yes' : 'No' })
  if (isResort) quickFacts.push({ label: 'Type', value: 'Resort & master plan community' })

  const hasStoredDescription = description && description.trim().length >= 180
  const useStoredDescription = hasStoredDescription && !resortStaticContent
  const fallbackParagraphs = dataDrivenParagraphs && dataDrivenParagraphs.length > 0 ? dataDrivenParagraphs : null

  const content = resortStaticContent ? (
    <>
      {renderParagraphs([resortStaticContent.overview])}
      {resortStaticContent.history && (
        <Section title="History & character">{renderParagraphs([resortStaticContent.history])}</Section>
      )}
      {resortStaticContent.amenities && (
        <Section title="Lifestyle & amenities">{renderParagraphs([resortStaticContent.amenities])}</Section>
      )}
      {resortStaticContent.golf_recreation && (
        <Section title="Golf & recreation">{renderParagraphs([resortStaticContent.golf_recreation])}</Section>
      )}
      {resortStaticContent.real_estate && (
        <Section title={`Real estate in ${communityName}`}>{renderParagraphs([resortStaticContent.real_estate])}</Section>
      )}
    </>
  ) : isResort && resortContent && typeof resortContent === 'object' && Object.keys(resortContent).length > 0 ? (
    <>
      {description && renderParagraphs(description.split(/\n\n+/).filter((p) => p.trim()))}
      <div className="mt-5 space-y-4">
        {Object.entries(resortContent).map(([key, value]) => (
          <div key={key}>
            <h3 className="text-base font-semibold text-primary">
              {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </h3>
            <p className="mt-1">{typeof value === 'string' ? value : JSON.stringify(value)}</p>
          </div>
        ))}
      </div>
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
      {communityName} is a {isResort ? 'resort & master plan ' : ''}community in {city}, Oregon. Browse active listings below for the latest homes for sale, market stats, and property details.
    </p>
  )

  return (
    <GeoAboutSection
      placeName={communityName}
      headingId="community-overview-heading"
      quickFacts={quickFacts}
    >
      {content}
    </GeoAboutSection>
  )
}
