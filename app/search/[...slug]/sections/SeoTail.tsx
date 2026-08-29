import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  v3Text,
  V3ChartCard,
  V3Ledger,
  V3Quiet,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { type PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import type { SearchPriceLadder } from '@/lib/search/price-ladder'
import type { CityInventoryPublish } from '@/lib/market/publish-city-inventory'
import { type buildMarketFaq } from '@/lib/site/market-faq'
import { type buildPresetFaq } from '@/lib/site/preset-faq'
import { type getAllCityHomesLink } from '../../../../lib/popular-searches'
import { type SearchPreset } from '../resolve-slug'

/** Below-fold SEO depth: the asking-price ladder, city +
 *  preset FAQs, preset cross-links, and the related-searches link cloud (see
 *  page.tsx call site). Leftover HUD / MarketSnapshot stays off this face.
 *
 *  FAQPage JSON-LD used to emit from FAQBlock. V3Quiet carries no structured
 *  data, so MetadataBlock emits the same items the Quiet renders.
 *
 *  The ladder is ONE chart, below the results, inside the market section the
 *  snapshot already opens — never a gallery, never above the listings. It
 *  bands the same tile array the snapshot's count and median publish from, so
 *  it costs no query and cannot disagree with the numbers above it. */
export function SearchSeoTail({
  isPlainCityPage,
  relatedCitySlug,
  city,
  published: _published,
  priceLadder,
  publicPace: _publicPace,
  publicSegments: _publicSegments,
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
  /** Null whenever the tile set was not a complete, uncapped census. */
  priceLadder?: SearchPriceLadder | null
  publicPace?: PublicPaceRow | null
  publicSegments?: readonly PublicSegmentRow[]
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
          {priceLadder ? (
            <div className="mx-auto mt-6 w-full max-w-3xl">
              <V3ChartCard
                id="search-price-ladder"
                title={v3Text(priceLadder.title)}
                line={v3Text(priceLadder.line)}
                source={v3Text(priceLadder.source)}
                chart={{
                  kind: 'range',
                  caption: v3Text(priceLadder.caption),
                  // The builder stays free of the component layer, so the
                  // branded names are applied here at the boundary.
                  rows: priceLadder.rows.map((row) => ({
                    tick: v3Text(row.tick),
                    value: row.value,
                    label: v3Text(row.label),
                    note: v3Text(row.note),
                  })),
                }}
              />
            </div>
          ) : null}
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
