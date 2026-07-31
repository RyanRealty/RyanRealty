import Link from 'next/link'
import { Body, H2 } from '@/components/site/primitives'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import { FAQBlock } from '@/components/site/FAQBlock'
import { type buildMarketFaq } from '@/lib/site/market-faq'
import { type buildPresetFaq } from '@/lib/site/preset-faq'
import { type getAllCityHomesLink } from '../../../../lib/popular-searches'
import { type SearchPreset } from '../resolve-slug'

/** Below-fold SEO depth: market snapshot band, city + preset FAQs, preset
 *  cross-links, and the related-searches link cloud (see page.tsx call site). */
export function SearchSeoTail({
  isPlainCityPage,
  relatedCitySlug,
  city,
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
  return (
    <>
      {isPlainCityPage && (
        <section id="search-seo" className="mt-12">
          <MarketSnapshot citySlug={relatedCitySlug!} cityName={city!} />
        </section>
      )}
      {cityMarketFaq && cityMarketFaq.faqs.length > 0 && (
        <FAQBlock
          items={cityMarketFaq.faqs}
          eyebrow="Common questions"
          title={`${city!} real estate questions`}
        />
      )}

      {/* Preset-page depth: preset-scoped FAQ + FAQPage JSON-LD (FAQBlock emits
          the schema from the same items, so text and markup never diverge). */}
      {presetDepth && presetDepth.faqs.length > 0 && (
        <FAQBlock
          items={presetDepth.faqs}
          eyebrow="Common questions"
          title={presetDepth.faqTitle}
        />
      )}

      {/* Preset cross-links: adjacent price bands + the same search in other
          cities (only cities whose data-grounded popular-search list carries
          this preset, so no empty-inventory links). */}
      {(presetBandLinks.length > 0 || presetCityLinks.length > 0) && (
        <section className="mt-14 border-t border-border pt-10" aria-labelledby="preset-crosslinks-heading">
          <H2 id="preset-crosslinks-heading">Similar searches</H2>
          {presetBandLinks.length > 0 && (
            <div className="mt-5">
              <Body size="small">Nearby price ranges</Body>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {presetBandLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:shadow-sm"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {presetCityLinks.length > 0 && (
            <div className="mt-5">
              <Body size="small">
                {subdivision
                  ? 'Widen the search'
                  : preset
                    ? `${preset.shortLabel} in other cities`
                    : 'In other cities'}
              </Body>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {presetCityLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:shadow-sm"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. Related searches — SEO internal links to this city's other popular searches. */}
      {(relatedAllHomes || relatedSearches.length > 0) && (
        <section className="mt-14 border-t border-border pt-10" aria-labelledby="related-searches-heading">
          <H2 id="related-searches-heading">Related searches</H2>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {relatedAllHomes && (
              <Link
                href={relatedAllHomes.href}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                {relatedAllHomes.label}
              </Link>
            )}
            {relatedSearches.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:shadow-sm"
              >
                {placeName} {l.label.toLowerCase()}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
