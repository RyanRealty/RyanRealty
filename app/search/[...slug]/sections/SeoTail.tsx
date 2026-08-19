import MarketSnapshot from '@/components/site/MarketSnapshot'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  v3Text,
  V3Ledger,
  V3Quiet,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import type { CityInventoryPublish } from '@/lib/market/publish-city-inventory'
import { type buildMarketFaq } from '@/lib/site/market-faq'
import { type buildPresetFaq } from '@/lib/site/preset-faq'
import { type getAllCityHomesLink } from '../../../../lib/popular-searches'
import { type SearchPreset } from '../resolve-slug'

/** Below-fold SEO depth: market snapshot band, city + preset FAQs, preset
 *  cross-links, and the related-searches link cloud (see page.tsx call site).
 *
 *  FAQPage JSON-LD used to emit from FAQBlock. V3Quiet carries no structured
 *  data, so MetadataBlock emits the same items the Quiet renders. */
export function SearchSeoTail({
  isPlainCityPage,
  relatedCitySlug,
  city,
  published,
  cityMarketFaq,
  presetDepth,
  presetBandLinks,
  presetCityLinks,
  relatedAllHomes,
  relatedSearches,
  placeName,
  subdivision,
  preset,
}: {
  isPlainCityPage: boolean
  relatedCitySlug: string | null
  city: string | undefined
  published?: CityInventoryPublish | null
  cityMarketFaq: ReturnType<typeof buildMarketFaq> | null
  presetDepth: ReturnType<typeof buildPresetFaq> | null
  presetBandLinks: { href: string; label: string }[]
  presetCityLinks: { href: string; label: string }[]
  relatedAllHomes: ReturnType<typeof getAllCityHomesLink> | null
  relatedSearches: { href: string; label: string }[]
  placeName: string
  subdivision: string | undefined
  preset: SearchPreset
}) {
  const faqSource = presetDepth?.faqs?.length
    ? { title: presetDepth.faqTitle, faqs: presetDepth.faqs }
    : cityMarketFaq?.faqs?.length
      ? { title: `${city!} real estate questions`, faqs: cityMarketFaq.faqs }
      : null

  const faqItems: V3QuietItem[] = faqSource
    ? faqSource.faqs.map((item) => ({
        kind: 'prose' as const,
        term: item.question,
        body: item.answer,
      }))
    : []

  const relatedRows: V3LedgerPlainRow[] = []
  if (relatedAllHomes?.href && relatedAllHomes.label.trim()) {
    relatedRows.push({
      href: relatedAllHomes.href,
      when: v3Text('City'),
      what: v3Text(relatedAllHomes.label),
      id: 'all-homes',
    })
  }
  for (const link of relatedSearches) {
    const label = `${placeName} ${link.label.toLowerCase()}`.trim()
    if (!link.href || !label) continue
    relatedRows.push({
      href: link.href,
      when: v3Text(placeName),
      what: v3Text(label),
      id: link.href,
    })
  }
  for (const link of presetBandLinks) {
    if (!link.href || !link.label.trim()) continue
    relatedRows.push({
      href: link.href,
      when: v3Text('Price range'),
      what: v3Text(link.label),
      id: `band-${link.href}`,
    })
  }
  const otherWhen = subdivision ? 'Wider search' : preset ? `${preset.shortLabel} in other cities` : 'Other cities'
  for (const link of presetCityLinks) {
    if (!link.href || !link.label.trim()) continue
    relatedRows.push({
      href: link.href,
      when: v3Text(otherWhen),
      what: v3Text(link.label),
      id: `city-${link.href}`,
    })
  }
  const [firstRelated, ...restRelated] = relatedRows

  return (
    <>
      {isPlainCityPage && relatedCitySlug && city ? (
        <section id="search-seo" className="mt-12">
          <MarketSnapshot
            citySlug={relatedCitySlug}
            cityName={city}
            publishedActiveCount={published?.count ?? null}
            publishedMedianListPrice={published?.medianListPrice ?? null}
          />
        </section>
      ) : null}

      {faqSource && faqItems.length > 0 ? (
        <>
          <MetadataBlock
            schema={{
              type: 'faqPage',
              items: faqSource.faqs.map((item) => ({
                question: item.question,
                answer: item.answer,
              })),
            }}
          />
          <V3Quiet
            id="search-faq"
            eyebrow="Common questions"
            heading={faqSource.title}
            items={faqItems}
          />
        </>
      ) : null}

      {firstRelated ? (
        <V3Ledger
          id="related-searches"
          eyebrow={v3Text('From this search')}
          heading={v3Text('Related searches')}
          rows={[firstRelated, ...restRelated]}
        />
      ) : null}
    </>
  )
}
