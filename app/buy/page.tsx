/**
 * /buy — buyer-education layer of Homes, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Stage (owned photo,
 * carrying the live market in its inventory variant), then Field, Ledger,
 * Quiet, Sheet. Five of the six, no two adjacent alike.
 *
 * THE PAGE CONTRACT, carried across unchanged: pageMetadata title/description/
 * path, revalidate 300, getSurfaceImage hero, BreadcrumbList + WebPage +
 * FAQPage JSON-LD, V3SectionTracker pageType="buy", listing-alert capture via
 * submitSearchAlertSignup (email + propertyType A + company honeypot), exits
 * to /homes-for-sale, /buy/[intent], /open-houses, /price-drops, /contact.
 *
 * Dual objectives: understand how buying works here, then
 * leave a named alert or a broker inquiry. Machine objective is served through
 * that, never instead of it.
 *
 * Chrome: layout mounts V3Chrome (sticky, in flow). This page does not remount
 * it. V3Breadcrumb belowNav={false}. V3Footer outside <main>.
 *
 * KB-era deletions: SmoothScrollProvider, KbBreadcrumb, KbFooter, kb-root,
 * kb.css, RegionalSfrAlertsBand / KbCommunityAlerts markup, six hero chips
 * (Search homes stays as the Stage primary; the rest moved to the closing
 * Quiet), the no-hand-off pitch.
 *
 * Parity: design_system/ryan-realty/ui_kits/buy/parity.json.
 */

import { getSurfaceImage, getListingTiles, getMarketPulseRegionSnapshot } from '@/lib/data'
import { getMarketPulseAllCitySnapshots } from '@/lib/data/market/getMarketPulseSnapshot'
import { curateFeaturedTiles } from '@/lib/kb/curate-featured'
import { homeFieldItems } from '@/app/_v3/home-field-items'
import { HomeHomesField } from '@/app/_v3/HomeHomesField'
import { HOME_TILE_FETCH, HOME_FIELD_LIMIT } from '@/app/_v3/home-constants'
import { REGIONAL_SEARCH_HREF } from '@/lib/search/publish-regional-search-href'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3Stage,
  V3SectionTracker,
} from '@/components/site/v3'
import { BuyAlertsSheet } from './_v3/BuyAlertsSheet.client'
import { buyHeroInventory } from './_v3/buy-hero-inventory'
import {
  BUY_EXITS,
  BUY_FACTS,
  BUYER_GUIDE_ROWS,
  FAQ_ITEMS,
  OLD_MILL_HERO,
} from './_v3/buy-constants'

export const revalidate = 300

export const metadata = pageMetadata({
  title: 'Buy a home in Central Oregon · Ryan Realty',
  description:
    'Homes for sale across Bend, Redmond, Sisters, Sunriver, and the towns around them. Live MLS data, local experts, and one broker who stays with you from your first search to closing.',
  path: '/buy',
  ogImage: '/images/homepage/sisters-downtown-three-peaks.jpg',
  keywords: [
    'buy home Bend Oregon',
    'Central Oregon homes for sale',
    'Bend real estate buyer',
    'Ryan Realty buyer',
    'homes for sale Bend',
  ],
})

export default async function BuyPage() {
  // LIVE INVENTORY (2026-08-27). This page's own competitiveTarget opens with
  // "live MLS search as the next step" and it rendered no listings -- a
  // buyer-intent page with no houses on it, recorded in openDefects and closed
  // here. Same Field as the homepage: HomeHomesField owns the map slot
  // (PlaceFieldMap inside the frame). Types are the lead chips.
  //
  // THE HERO'S OWN FIGURES (SITE-46, 2026-09-09). The Field was below the fold,
  // so the first viewport still carried no data at all and the taste table
  // scored this page 42. One more DAL read, one row: the Central Oregon region
  // row of market_pulse_live, carrying the same Market Truth detached overlay
  // and the same 90-day pace metric the region deep dive publishes -- so the
  // three figures in the hero and the two sections its doors open print the
  // same numbers. No second query and no aggregate in page code (§0, §7 rule
  // 2); ./_v3/buy-hero-inventory.ts turns the row into props.
  const [buyTiles, buyCities, regionPulse] = await Promise.all([
    getListingTiles({ status: 'active', propertySubType: 'Single Family Residence', limit: HOME_TILE_FETCH }).catch(() => []),
    getMarketPulseAllCitySnapshots().catch(() => []),
    getMarketPulseRegionSnapshot('central-oregon').catch(() => null),
  ])
  // The same six towns the homepage leads with, same order, off the pulse
  // snapshots (a lib/data read; ci:page-action-imports bans a new page->action
  // read, which is where the city index lives).
  const BUY_TOWN_ORDER = ['bend', 'la-pine', 'redmond', 'sunriver', 'sisters', 'terrebonne']
  const buyCityBySlug = new Map(buyCities.map((c) => [c.geo_slug, c] as const))
  const buyTowns = BUY_TOWN_ORDER.flatMap((slug) => {
    const c = buyCityBySlug.get(slug)
    return c ? [{ name: c.geo_label, medianPrice: c.median_list_price }] : []
  })
  const buyFieldItems = homeFieldItems(
    curateFeaturedTiles(buyTiles, buyTowns, HOME_FIELD_LIMIT),
    HOME_FIELD_LIMIT,
  )

  const heroSrc = await getSurfaceImage('hero', {
    geoTags: ['central-oregon'],
    seed: '/buy',
    fallback: OLD_MILL_HERO,
  })
  const [firstGuide, ...restGuides] = BUYER_GUIDE_ROWS

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />

        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Buy', url: '/buy' },
              ],
            },
            {
              type: 'webPage',
              name: 'Buy a home in Central Oregon · Ryan Realty',
              description:
                'Homes for sale across Bend, Redmond, Sisters, Sunriver, and the towns around them. Live MLS data, local experts, and one broker who stays with you from your first search to closing.',
              url: '/buy',
            },
            {
              type: 'faqPage',
              items: [...FAQ_ITEMS],
            },
          ]}
        />

        <div className="relative">
          <V3Stage
            id="top"
            headingLevel={1}
            eyebrow="Central Oregon"
            headline="Buy a home in Central Oregon"
            posterSrc={heroSrc ?? OLD_MILL_HERO}
            overlayStrength="standard"
            /* The live market, inside the hero. Undefined when fewer than two
               figures could be sourced, and then this Stage is the quiet photo
               form it has always been. */
            inventory={buyHeroInventory(regionPulse)}
            action={{ label: 'Search homes', href: REGIONAL_SEARCH_HREF }}
          />
          {/* One band, one navy. bg-primary/70 left a seam: V3Breadcrumb's
              on-media form paints --v3-surface-inverse across the 72rem
              measure, so a translucent full-bleed wrapper behind it rendered a
              lighter navy to the left and right of a darker navy bar. bg-navy
              is the same token the component paints, so the band is one color
              across the frame. */}
          <div className="absolute inset-x-0 top-0 z-10 bg-navy">
            <V3Breadcrumb
              tone="on-media"
              belowNav={false}
              trail={[{ label: 'Home', href: '/' }, { label: 'Buy' }]}
            />
          </div>
        </div>

        {/* Pattern 2, Field -- the houses, first thing after the Stage. */}
        <HomeHomesField
          fieldItems={buyFieldItems}
          emptyMessage="No photographed active single-family home with a list price and a street address returned on this refresh."
        />

        {firstGuide ? (
          <V3Ledger
            id="buyer-guides"
            eyebrow={v3Text('Buyer guides')}
            heading={v3Text('First-time buyers, relocations, and investment property')}
            rows={[firstGuide, ...restGuides]}
          />
        ) : null}

        <V3Quiet
          id="how-it-works"
          eyebrow="Buying here"
          heading="How a purchase works"
          items={BUY_FACTS}
        />

        <BuyAlertsSheet />

        <V3Quiet
          id="next"
          eyebrow="Next step"
          heading="From this page"
          items={BUY_EXITS}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
