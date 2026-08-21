import CommunityPageTracker from '@/components/community/CommunityPageTracker'
import { FAQBlock } from '@/components/site/FAQBlock'
import { MarketSources } from '@/components/site/MarketSources'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import type { KbFeaturedItem } from '@/components/site/kb/types'
import { CommDAsk } from './CommDAsk'
import { CommDChartRoom } from './CommDChartRoom'
import { CommDCopy } from './CommDCopy'
import { CommDDock } from './CommDDock.client'
import { CommDFooter } from './CommDFooter'
import { CommDGround } from './CommDGround'
import { CommDHero } from './CommDHero'
import { CommDHomes } from './CommDHomes'
import { CommDIdentity } from './CommDIdentity'
import { CommDSchools } from './CommDSchools'
import type { CommDChartCard } from '@/lib/communities/comm-d-chart-room'
import type { CommDGroundTile } from '@/lib/communities/comm-d-ground'
import './comm-d.css'

export function CommunityFeaturedView(props: {
  slug: string
  name: string
  cityName: string
  activeCount: number | null
  medianListPrice: number | null
  asks: Array<{ kicker: string; value: string }>
  heroPhoto: string
  posterAlt: string
  mediaCaption?: string
  heroLead: string
  homesHref: string
  listingsHref: string
  groundTiles: readonly CommDGroundTile[]
  homes: readonly KbFeaturedItem[]
  aboutParagraphs: readonly string[]
  mapGeo: KbMapGeo
  mapPolygons?: {
    type: 'FeatureCollection'
    features: Array<{ type: 'Feature'; geometry: unknown; properties: { name: string } }>
  }
  centerLonLat?: [number, number]
  chartCards: readonly CommDChartCard[]
  schoolDistrictName: string | null
  schoolDistrictSlug: string | null
  rating: number
  reviewCount: number
  faqs: Array<{ question: string; answer: string }>
}) {
  return (
    <main className="comm-d">
      <CommunityPageTracker
        slug={props.slug}
        communityName={props.name}
        city={props.cityName}
        activeCount={props.activeCount}
        medianPrice={props.medianListPrice}
      />
      <SmoothScrollProvider>
        <CommDHero
          posterSrc={props.heroPhoto}
          posterAlt={props.posterAlt}
          lead={props.heroLead}
          homesHref={props.homesHref}
          mediaCaption={props.mediaCaption}
        />
        <CommDIdentity name={props.name} asks={props.asks} />
        <CommDGround name={props.name} tiles={props.groundTiles} />
        <CommDHomes name={props.name} items={props.homes} listingsHref={props.listingsHref} />
        <div className="comm-d-map">
          <KbListingMap
            geojson={props.mapGeo}
            totalActive={props.activeCount ?? props.mapGeo.features.length}
            fitToFeatures
            showRegionMarkers={false}
            polygons={props.mapPolygons}
            browseHref={props.listingsHref}
            eyebrow="Map"
            title={`Homes in\n${props.name}`}
            subtitle={`${props.name}, ${props.cityName}. Live pins from the regional MLS.`}
            centerLonLat={props.centerLonLat}
          />
        </div>
        <CommDCopy name={props.name} paragraphs={props.aboutParagraphs} />
        <CommDChartRoom cards={props.chartCards} />
        <CommDSchools
          name={props.name}
          districtName={props.schoolDistrictName}
          districtSlug={props.schoolDistrictSlug}
        />
        <CommDAsk name={props.name} rating={props.rating} reviewCount={props.reviewCount} />
        {props.faqs.length > 0 ? (
          <section className="comm-d-faq" id="faq" aria-label={`${props.name} real estate questions`}>
            <div className="comm-d-wrap">
              <FAQBlock
                items={props.faqs}
                eyebrow="Common questions"
                title={`${props.name} real estate questions`}
              />
            </div>
          </section>
        ) : null}
        <div className="comm-d-wrap">
          <MarketSources sources={['ods']} />
        </div>
        <CommDFooter cityName={props.cityName} />
        <CommDDock rating={props.rating} reviewCount={props.reviewCount} />
      </SmoothScrollProvider>
    </main>
  )
}
