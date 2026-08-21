import CommunityPageTracker from '@/components/community/CommunityPageTracker'
import { FAQBlock } from '@/components/site/FAQBlock'
import { MarketSources } from '@/components/site/MarketSources'
import { CommunityGolfLinks } from '@/components/site/explore/CommunityGolfLinks'
import { PlaceInventoryMap } from '@/components/site/explore/PlaceInventoryMap'
import { KbAbout } from '@/components/site/kb/KbAbout'
import { KbActivity } from '@/components/site/kb/KbActivity.client'
import { KbAreaGuideVideo } from '@/components/site/kb/KbAreaGuideVideo'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbBuyCta } from '@/components/site/kb/KbBuyCta.client'
import { KbCommunities } from '@/components/site/kb/KbCommunities.client'
import { KbCommunityAlerts } from '@/components/site/kb/KbCommunityAlerts.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbHero } from '@/components/site/kb/KbHero.client'
import type { KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbResortOverview } from '@/components/site/kb/KbResortOverview'
import { KbSchools } from '@/components/site/kb/KbSchools'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTicker } from '@/components/site/kb/KbTicker.client'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import type {
  KbCommunityItem,
  KbFeaturedItem,
  KbMarketData,
  KbTickerItem,
  KbTownItem,
} from '@/components/site/kb/types'
import { MarketCoreCharts } from '@/components/market/MarketCoreCharts'
import { CONTACT } from '@/lib/brand/contact'
import { buildTimeRails } from '@/lib/build-phase'
import type { CoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import type { AmenityBlogPost, ListingTile } from '@/lib/data'
import type { PublishedPlaceHoa } from '@/lib/market/publish-place-hoa'
import type { PublishedSellMedian } from '@/lib/market/publish-median-caption'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import { TESTIMONIALS } from '@/lib/testimonials'
import type { KbActivityItem } from '@/components/site/kb/KbActivity.client'
import type { KbArticlePost } from '@/components/site/kb/KbArticles'
import type { KbOpenHouseItem } from '@/components/site/kb/KbOpenHouses.client'

export function CommunityKbView(props: {
  slug: string
  name: string
  cityName: string
  citySlug: string
  subdivision: string
  activeCount: number | null
  medianListPrice: number | null
  medianDaysToPending: number | null
  heroPhoto: string
  posterAlt: string
  mediaCaption?: string
  communityLabel: string
  heroLead: string
  richContent: ResortCommunityContent | null
  amenityPosts: Record<string, AmenityBlogPost>
  aliases: string[]
  publishedHoa: PublishedPlaceHoa | null
  aboutParagraphs: string[]
  aboutFacts: { label: string; value: string }[]
  featuredItems: KbFeaturedItem[]
  tickerItems: KbTickerItem[]
  asOfLabel: string | null
  communityTiles: ListingTile[]
  mapGeo: KbMapGeo
  mapPolygons?: {
    type: 'FeatureCollection'
    features: Array<{ type: 'Feature'; geometry: unknown; properties: { name: string } }>
  }
  centerLonLat?: [number, number]
  listingsHref: string
  marketData: KbMarketData
  chartScopeLabel?: string
  coreCharts: CoreChartSeries | null
  coreChartsScopeLabel?: string
  communityItems: KbCommunityItem[]
  areaGuideVideo: { url: string; wide?: boolean } | null
  openHouseItems: KbOpenHouseItem[]
  activityItems: KbActivityItem[]
  schoolDistrictName: string | null
  schoolDistrictSlug: string | null
  articlePosts: KbArticlePost[]
  otherCityItems: KbTownItem[]
  sellMedian: PublishedSellMedian | null
  soldCount30d: number | null
  isResort: boolean
  faqs: Array<{ question: string; answer: string }>
  refreshedAt: string | null
  contactHref: string
  strContactHref: string
}) {
  const {
    slug,
    name,
    cityName,
    citySlug,
    subdivision,
    activeCount,
    medianListPrice,
    medianDaysToPending,
    heroPhoto,
    posterAlt,
    mediaCaption,
    communityLabel,
    heroLead,
    richContent,
    amenityPosts,
    aliases,
    publishedHoa,
    aboutParagraphs,
    aboutFacts,
    featuredItems,
    tickerItems,
    asOfLabel,
    communityTiles,
    mapGeo,
    mapPolygons,
    centerLonLat,
    listingsHref,
    marketData,
    chartScopeLabel,
    coreCharts,
    coreChartsScopeLabel,
    communityItems,
    areaGuideVideo,
    openHouseItems,
    activityItems,
    schoolDistrictName,
    schoolDistrictSlug,
    articlePosts,
    otherCityItems,
    sellMedian,
    soldCount30d,
    isResort,
    faqs,
    refreshedAt,
    contactHref,
    strContactHref,
  } = props

  return (
    <main>
      <CommunityPageTracker
        slug={slug}
        communityName={name}
        city={cityName}
        activeCount={activeCount}
        medianPrice={medianListPrice}
      />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Communities', href: '/communities' },
          ...(cityName ? [{ label: cityName, href: citySlug ? `/cities/${citySlug}` : '/cities' }] : []),
          { label: name },
        ]}
      />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount,
            medianListPrice,
            medianDaysToPending,
          }}
          eyebrow={communityLabel}
          titleTop={name}
          titleBottom="Homes for Sale"
          lead={heroLead}
          videoSrc={null}
          posterSrc={heroPhoto}
          posterAlt={posterAlt}
          mediaCaption={mediaCaption}
          cta={{ href: '#homes', label: `See ${name} homes` }}
        />
        <KbResortOverview
          content={richContent}
          name={name}
          postsBySlug={amenityPosts}
          aliases={aliases}
          publishedHoa={publishedHoa}
        />
        {richContent ? null : aboutParagraphs.length > 0 ? (
          <KbAbout
            eyebrow={communityLabel}
            heading={`Living in ${name}`}
            paragraphs={aboutParagraphs}
            facts={aboutFacts}
          />
        ) : null}
        <KbFeatured
          items={featuredItems}
          eyebrow={`${name} · For sale`}
          viewAllHref="#homes"
          viewAllLabel={`See every ${name} home for sale`}
          viewAllPlace={name}
          totalCount={activeCount || null}
        />
        <KbTicker items={tickerItems} />
        {asOfLabel ? (
          <p className="community-freshness-signal" aria-label={`Market data freshness: ${asOfLabel}`}>
            Market data updated {asOfLabel}
          </p>
        ) : null}
        <p className="community-contact-line">
          Questions about {name}?{' '}
          <a href={`tel:${CONTACT.phoneDirectTel}`} className="community-contact-phone">
            {CONTACT.phoneDirect}
          </a>
        </p>
        <PlaceInventoryMap
          tiles={communityTiles}
          mapGeo={mapGeo}
          polygons={mapPolygons}
          placeName={name}
          totalActive={activeCount ?? mapGeo.features.length}
          centerLonLat={centerLonLat}
          viewAllHref={listingsHref}
        />
        <KbMarketHud
          data={marketData}
          eyebrow={`${name} · The market`}
          geoName={name}
          asOf={refreshedAt}
          chartScopeLabel={chartScopeLabel}
        >
          {coreCharts ? (
            <div className="pt-10" aria-label={`${name} market trend charts`}>
              <MarketCoreCharts
                data={coreCharts}
                heading={`${name} market trends`}
                scopeLabel={coreChartsScopeLabel}
              />
            </div>
          ) : null}
        </KbMarketHud>
        <KbCommunities communities={communityItems} eyebrow={`${cityName} · Communities`} />
        <KbAreaGuideVideo
          videoUrl={areaGuideVideo?.url ?? null}
          wide={areaGuideVideo?.wide}
          locationName={name}
          posterSrc={heroPhoto}
        />
        {buildTimeRails(true) || openHouseItems.length > 0 ? (
          <KbOpenHouses
            items={openHouseItems}
            eyebrow={`${cityName} · This week`}
            heading="Open houses"
            viewAllHref={`/open-houses/${citySlug}`}
          />
        ) : null}
        <KbActivity
          items={activityItems}
          eyebrow={`Live · ${cityName}`}
          heading="Latest market activity"
          viewAllHref="/housing-market"
          viewAllLabel="Full market pulse"
        />
        <KbSchools communityName={name} districtName={schoolDistrictName} districtSlug={schoolDistrictSlug} />
        <CommunityGolfLinks communitySlug={slug} communityName={name} />
        <KbArticles
          posts={articlePosts}
          eyebrow="Guides and news"
          heading={`${name} real estate guides`}
          subtitle={`Housing news, market data, and buyer and seller advice for ${name} and ${cityName}.`}
        />
        <KbExploreTowns
          towns={otherCityItems}
          eyebrow="Central Oregon"
          title="Other cities"
          sectionId="nearby"
          cta={{ href: '/cities', label: 'Every city' }}
        />
        <KbTestimonials reviews={TESTIMONIALS.slice(0, 8)} />
        <KbTeam />
        <KbBuyCta communityName={name} listingsHref={listingsHref} contactHref={contactHref} />
        <KbCommunityAlerts communityName={name} city={cityName} subdivision={subdivision} />
        <KbSell
          data={{
            medianListPrice: sellMedian?.value ?? null,
            medianCaption: sellMedian?.caption ?? null,
            medianDaysToPending,
            soldCount30d,
          }}
          eyebrow={`Sell in ${name}`}
        />
        {isResort ? (
          <div className="comm-str-note" aria-label={`${name} second home information`}>
            <div className="comm-str-note-inner">
              <span className="comm-str-label">Second homes</span>
              <p className="comm-str-text">
                Short-term rental potential in {name} varies by HOA rules, community covenants, and Oregon
                regulations.{' '}
                <a href={strContactHref}>Reach out for current rental guidelines</a> before you assume what is
                permitted or what it could earn.
              </p>
            </div>
          </div>
        ) : null}
        {faqs.length > 0 ? (
          <section id="faq" aria-label={`${name} real estate questions`}>
            <FAQBlock items={faqs} eyebrow="Common questions" title={`${name} real estate questions`} />
          </section>
        ) : null}
        <MarketSources sources={['ods']} />
      </SmoothScrollProvider>
    </main>
  )
}
