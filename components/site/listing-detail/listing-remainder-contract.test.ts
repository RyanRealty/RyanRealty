import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/listing/[listingKey]/page.tsx'), 'utf8')
const HERO = readFileSync(resolve('components/site/listing-detail/ListingHero.tsx'), 'utf8')

describe('listing remainder composition', () => {
  it('does not start the listing hero on a 320 Spark thumb', () => {
    expect(HERO).toContain('preferListingMosaicPhotoUrl')
    expect(HERO).toMatch(/const live = preferListingMosaicPhotoUrl\(src\)/)
    expect(HERO).toMatch(/<img src=\{live\}/)
    expect(HERO).not.toMatch(/listingRowPhotoSrc\(src, LISTING_FIELD_LEAD_PHOTO_SIZE\)/)
    expect(HERO).not.toContain('listing-strip__toggle')
    expect(HERO).not.toContain('stripOpen')
    expect(PAGE).toContain('LISTING_FIELD_LEAD_PHOTO_SIZE')
    expect(PAGE).toContain('LISTING_MOSAIC_LEAD_PHOTO_SIZE')
    const CSS = readFileSync(resolve('components/site/listing-detail/listing-detail.css'), 'utf8')
    expect(CSS).toMatch(/\.listing-mosaic__slide img\s*\{[\s\S]*?object-fit:\s*contain/)
    expect(CSS).not.toMatch(/\.listing-mosaic__slide img,\s*\n\.listing-mosaic__slide video[\s\S]{0,120}object-fit:\s*cover/)
  })

  it('locks Save and Share on the listing page so they cannot silently vanish', () => {
    const STRIP = readFileSync(resolve('components/site/listing-detail/PriceCtaStrip.tsx'), 'utf8')
    const CSS = readFileSync(resolve('components/site/listing-detail/listing-detail.css'), 'utf8')
    const PARITY = readFileSync(
      resolve('design_system/ryan-realty/ui_kits/listing-detail/parity.json'),
      'utf8',
    )
    expect(PAGE).toMatch(/import \{ ListingSaveButton/)
    expect(PAGE).toMatch(/import \{ ListingShareButton/)
    expect(PAGE).toContain('listingDocumentTitle')
    expect(STRIP).toContain('<ListingSaveButton')
    expect(STRIP).toContain('<ListingShareButton')
    expect(STRIP).toContain('listing-face__keep')
    const SAVE_SHEET = readFileSync(
      resolve('components/site/listing-detail/ListingGuestSaveSheet.client.tsx'),
      'utf8',
    )
    expect(SAVE_SHEET).toMatch(/from '@\/components\/ui\/sheet'/)
    expect(SAVE_SHEET).toContain('SheetContent')
    expect(SAVE_SHEET).toContain('side="right"')
    expect(SAVE_SHEET).not.toContain('surface="drawer"')
    expect(SAVE_SHEET).not.toContain('top-16')
    expect(PAGE).not.toMatch(/<ListingBrokerBar/)
    expect(PAGE).not.toMatch(/<ListingMobileContactBar/)
    expect(PAGE).not.toMatch(/<V3PhoneDock[\s/>]/)
    const LAYOUT = readFileSync(resolve('app/layout.tsx'), 'utf8')
    expect(LAYOUT).not.toMatch(/V3PhoneDock/)
    const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')
    expect(CHROME).toContain('<V3WorkWithUs surface="chrome" placement="chrome"')
    expect(HERO).toMatch(/from '@\/components\/motion\/tabs'/)
    expect(HERO).toMatch(/from '@\/components\/ui\/carousel'/)
    expect(HERO).not.toContain('V3Tabs')
    expect(HERO).toContain('PhotoSkeleton')
    expect(HERO).toMatch(/listingGalleryFrameAlt/)
    expect(HERO).not.toMatch(/alt=""/)
    const SHEET = readFileSync(resolve('components/site/v3/V3Sheet.tsx'), 'utf8')
    expect(SHEET).toMatch(/from '@\/components\/ui\/sheet'/)
    expect(PARITY).toContain('"name": "ListingSaveButton"')
    expect(PARITY).toContain('"name": "ListingShareButton"')
    const receipt = JSON.parse(PARITY) as {
      tasteReview?: {
        shotSpec?: { states?: string[] }
        demoMatch?: unknown
        competitiveBriefPass?: unknown
      }
    }
    const states = receipt.tasteReview?.shotSpec?.states ?? []
    expect(states.some((s) => /save-open/.test(s))).toBe(true)
    expect(states.some((s) => /share-open/.test(s))).toBe(true)
    expect(states.some((s) => /gallery-open/.test(s))).toBe(true)
    // Tip Ready receipt from Mini Cursor judge (honest — do not invent)
    expect(receipt.tasteReview?.demoMatch).toBe(true)
    expect(receipt.tasteReview?.competitiveBriefPass).toBe(true)
    const catalog = JSON.parse(
      readFileSync(resolve('design_system/public/taste-catalog.json'), 'utf8'),
    ) as { classes?: { 'listing-detail'?: { demoStates?: string[] } } }
    const demoStates = catalog.classes?.['listing-detail']?.demoStates ?? []
    expect(demoStates.some((s) => /save-open/.test(s) && /click/.test(s))).toBe(true)
    expect(demoStates.some((s) => /share-open/.test(s) && /click/.test(s))).toBe(true)
    expect(demoStates.some((s) => /gallery-open/.test(s) && /click/.test(s))).toBe(true)
    const SHARE = readFileSync(resolve('components/site/listing-detail/ListingShareButton.tsx'), 'utf8')
    expect(SHARE).toMatch(/from '@\/components\/ui\/dialog'/)
    expect(SHARE).toMatch(/from '@\/components\/ui\/input'/)
    expect(STRIP).not.toContain('window.location.href')
    expect(STRIP).toContain('getCanonicalSiteUrl')
    expect(STRIP).toMatch(/from '@\/components\/ui\/button-group'/)
    expect(STRIP).toContain('signedIn')
    expect(STRIP).toContain('listing-face__price-row')
    expect(STRIP).toContain('<ListingShareDialog')
    expect(CSS).toMatch(/\.listing-face__keep[\s\S]*display:\s*flex/)
    expect(CSS).not.toContain('backdrop-blur')
    const SHEET_UI = readFileSync(resolve('components/ui/sheet.tsx'), 'utf8')
    const DIALOG_UI = readFileSync(resolve('components/ui/dialog.tsx'), 'utf8')
    expect(SHEET_UI).not.toContain('backdrop-blur')
    expect(DIALOG_UI).not.toContain('backdrop-blur')
    expect(SHEET_UI).toContain('bg-foreground/50')
    expect(DIALOG_UI).toContain('bg-foreground/50')
    const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(rules).not.toMatch(/\.listing-face__keep[^{]*\{[^}]*display:\s*none/)
    expect(rules).not.toMatch(/\.listing-face__actions\s*\{\s*display:\s*none/)
    expect(rules).not.toMatch(/\.listing-face__ask[^{]*\{[^}]*display:\s*none/)
  })

  it('names installed catalog jobs on the receipt and imports the source (SITE-99)', () => {
    const PARITY = JSON.parse(
      readFileSync(resolve('design_system/ryan-realty/ui_kits/listing-detail/parity.json'), 'utf8'),
    ) as {
      tasteReview?: { adaptedFrom?: Array<string | { id?: string }>; defects?: Array<{ replaceWith?: unknown }> }
    }
    const adapted = (PARITY.tasteReview?.adaptedFrom ?? []).map((hit) =>
      typeof hit === 'string' ? hit : hit.id,
    )
    expect(adapted.length).toBeGreaterThan(0)
    for (const id of [
      'shadcn-carousel',
      'shadcn-breadcrumb',
      'shadcn-button-group',
      'shadcn-sheet',
      'shadcn-dialog',
      'beui-tabs',
      'beui-action-swap',
      'transitions-modal',
      'beautifului-loading',
    ]) {
      expect(adapted).toContain(id)
    }
    for (const defect of PARITY.tasteReview?.defects ?? []) {
      expect(defect).toHaveProperty('replaceWith')
    }
    const CAROUSEL = readFileSync(resolve('components/site/v3/V3Carousel.client.tsx'), 'utf8')
    const GROUP = readFileSync(resolve('components/site/listing-detail/PriceCtaStrip.tsx'), 'utf8')
    const SHEET = readFileSync(resolve('components/site/v3/V3Sheet.tsx'), 'utf8')
    const LIGHTBOX = readFileSync(resolve('components/site/listing-detail/PhotoGalleryLightbox.tsx'), 'utf8')
    const TABS = readFileSync(resolve('components/site/v3/V3Tabs.tsx'), 'utf8')
    const SWAP = readFileSync(resolve('components/site/listing-detail/ListingSaveButton.tsx'), 'utf8')
    expect(CAROUSEL).toMatch(/from '@\/components\/ui\/carousel'/)
    expect(GROUP).toMatch(/from '@\/components\/ui\/button-group'/)
    expect(SHEET).toMatch(/from '@\/components\/ui\/sheet'/)
    expect(LIGHTBOX).toMatch(/from '@\/components\/ui\/dialog'/)
    expect(LIGHTBOX).not.toContain('showCloseButton={false}')
    expect(LIGHTBOX).not.toContain('h-dvh')
    expect(HERO).toContain('listing-hero-bleed')
    expect(HERO).toContain('listing-frame__tabs')
    expect(HERO).not.toMatch(/listing-hero-bleed listing-frame listing-mosaic/)
    const SHARE_BTN = readFileSync(resolve('components/site/listing-detail/ListingShareButton.tsx'), 'utf8')
    expect(SHARE_BTN).toMatch(/from '@\/components\/ui\/dialog'/)
    expect(LIGHTBOX).toMatch(/from '@\/components\/motion\/transitions-modal'/)
    expect(TABS).toMatch(/from '@\/components\/motion\/tabs'/)
    expect(SWAP).toMatch(/from '@\/components\/motion\/action-swap'/)
    expect(HERO).toMatch(/from '@\/components\/motion\/photo-skeleton'/)
    // Tip Ready: ButtonGroup + ActionSwapText both catalog-direct on PriceCtaStrip; no V3 wrapper.
  })

  it('keeps beds, baths, and living sqft on the Facts sheet (SITE-115)', () => {
    const SPECS = readFileSync(resolve('components/site/listing-detail/PropertySpecs.tsx'), 'utf8')
    expect(SPECS).toContain('listing.beds')
    expect(SPECS).toContain('listing.baths')
    expect(SPECS).toMatch(/Living area/)
    expect(SPECS).toMatch(/sqft|totalLivingAreaSqFt/)
    expect(SPECS).toContain('Garage')
  })

  it('states the 13-section house page on the route', () => {
    // 12 became 13 on 2026-09-09 when the MLS public remarks came back as row 5
    // (Matt: "mls descriptions must come back"; CLAUDE.md §2). The count and the
    // comment move together, which is the whole point of pinning it here.
    expect(PAGE).toMatch(/PAGE_INVENTORY listing \(house URL\), 13 rows/)
    expect(PAGE).toMatch(/<DescriptionBlock publicRemarks=\{listing\.publicRemarks\} \/>/)
  })

  it('composes inventory order: media, ask, facts, about, payment, map, schools, parks, tax, CC&Rs, similar, broker', () => {
    const main = PAGE.slice(PAGE.indexOf('const main = ('), PAGE.indexOf('const floating ='))
    // SITE-21 put a SECOND ListingSimilarStrip mount high in the page for the
    // off-market composition, so the on-market rail is the last one, not the
    // first. lastIndexOf, deliberately: indexOf would now read the off-market
    // mount and call the on-market page reordered when it is not.
    const order = [
      '<PriceCtaStrip',
      '<PropertySpecs',
      '<DescriptionBlock',
      '<MortgageCalculator',
      '{atlasBlock}',
      '<SchoolsBlock',
      '<ListingAroundHere',
      '<ListingAskInstrument',
      '<ListingTaxHistory',
      '<GoverningDocumentsBlock',
    ]
    const positions = [
      ...order.map((token) => main.indexOf(token)),
      main.lastIndexOf('<ListingSimilarStrip'),
      main.indexOf('<ListingBrokerCTA'),
      main.indexOf('<ListingAttribution'),
    ]
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(PAGE).toMatch(/showEstPayment=\{false\}/)
  })

  it('composes the OFF-MARKET order: price, sold facts, homes for sale, saved search', () => {
    // SITE-21 / MASTER_SPEC §4.9. A home that is not for sale leads with what
    // happened to it, then the homes a reader can actually buy, then the ask
    // that replaces the tour. Everything after that is the house's own record.
    const main = PAGE.slice(PAGE.indexOf('const main = ('), PAGE.indexOf('const floating ='))
    const order = [
      '<PriceCtaStrip',
      '<ListingOffMarketFacts',
      '<ListingSimilarStrip',
      '<ListingLikeThisAlerts',
      '<PropertySpecs',
    ]
    const positions = order.map((token) => main.indexOf(token))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  /**
   * SITE-33 (Matt 2026-09-08). The out-of-area listing tier: the block renders,
   * the page still serves, robots is "noindex, follow" (never nofollow), and
   * both halves read the SAME predicate as the sitemap.
   */
  it('discloses the market on an out-of-area home, before it says anything else about it', () => {
    const main = PAGE.slice(PAGE.indexOf('const main = ('), PAGE.indexOf('const floating ='))
    const notice = main.indexOf('<ListingOutOfAreaNotice')
    expect(notice).toBeGreaterThan(-1)
    // Under the price strip and above every other claim the page makes.
    expect(notice).toBeGreaterThan(main.indexOf('<PriceCtaStrip'))
    for (const later of ['<ListingOffMarketFacts', '<PropertySpecs', '{atlasBlock}']) {
      expect(notice).toBeLessThan(main.indexOf(later))
    }
  })

  it('decides the block and the robots directive with one predicate', () => {
    expect(PAGE).toMatch(/import \{ outOfAreaListingPolicy \} from '@\/lib\/data\/listings\/service-area'/)
    // Once in generateMetadata, once in the render.
    expect(PAGE.match(/outOfAreaListingPolicy\(listing\.city\)/g)).toHaveLength(2)
    expect(PAGE).toMatch(/buildListingOutOfAreaNotice\(/)
  })

  it('leaves the index WITH follow preserved, and keeps the page serving', () => {
    expect(PAGE).toMatch(/noindex: outOfArea !== null/)
    // `nofollow` is a SEPARATE pageMetadata flag (SITE-25) and is not wanted:
    // the /oregon referral pages link IN to these pages, and these pages link
    // back out to the place, plat and city they sit in. Setting it would throw
    // both away. Matched as the property, so the word may still be explained
    // in a comment.
    expect(PAGE).not.toMatch(/nofollow\s*:/)
    // The policy never refuses the row — the page renders in full either way.
    expect(PAGE).not.toMatch(/outOfArea[\s\S]{0,80}<ListingUnavailable/)
    expect(PAGE).not.toMatch(/outOfArea[\s\S]{0,80}notFound\(\)/)
  })

  it('does not restack leftover HUD, CMA, rental, or a second lot map', () => {
    expect(PAGE).not.toMatch(/<NeighborhoodMarketContext/)
    expect(PAGE).not.toMatch(/<LivePricingRead/)
    expect(PAGE).not.toMatch(/<ListingFeaturedHomes/)
    expect(PAGE).not.toMatch(/<ListingTourCard/)
    // Ask claim uses ListingAskInstrument + leftoverHudKpis (ci:publish-listing-share).
    expect(PAGE).toMatch(/<ListingAskInstrument/)
    expect(PAGE).toMatch(/buildListingAskClaim/)
    expect(PAGE).toMatch(/leftoverHudKpis/)
    expect(PAGE).not.toMatch(/<PublishedCmaSection/)
    expect(PAGE).not.toMatch(/<RentalAnalysis/)
    expect(PAGE).not.toMatch(/id="lot"/)
  })

  it('carries the saved search on OFF-MARKET rows only, never as a second on-market ask', () => {
    // SITE-21. The alerts sheet was off this page because an on-market listing
    // already has one ask (Tour beside the price) and a second capture under it is
    // the stacked-ask tell. Off market there is no first ask, so this is it.
    expect(PAGE).toMatch(/<ListingLikeThisAlerts/)
    const mount = PAGE.slice(PAGE.indexOf('<ListingLikeThisAlerts') - 200, PAGE.indexOf('<ListingLikeThisAlerts'))
    expect(mount).toMatch(/\{offMarket \?/)
  })

  it('locks listing fold density on the shared crumb + hero (ci:listing-fold-density)', () => {
    const PARITY = JSON.parse(
      readFileSync(resolve('design_system/ryan-realty/ui_kits/listing-detail/parity.json'), 'utf8'),
    ) as {
      foldDensity?: {
        gate?: string
        crumbCollapseAt?: number
        crumbOverlayOnListing?: boolean
        overlayCompactOnListing?: boolean
        mosaicHeightUsesViewport?: boolean
        phoneFacePadTop?: string
        phoneShellPadTop?: string
        phoneHeroColumnPad?: string
        phoneHeroToFaceGapCancel?: boolean
        titleStackOnPhone?: boolean
      }
    }
    expect(PARITY.foldDensity?.gate).toBe('ci:listing-fold-density')
    expect(PARITY.foldDensity?.crumbCollapseAt).toBe(3)
    expect(PARITY.foldDensity?.crumbOverlayOnListing).toBe(true)
    expect(PARITY.foldDensity?.overlayCompactOnListing).toBe(true)
    expect(PARITY.foldDensity?.mosaicHeightUsesViewport).toBe(true)
    expect(PARITY.foldDensity?.phoneFacePadTop).toBe('0')
    expect(PARITY.foldDensity?.phoneShellPadTop).toBe('0')
    expect(PARITY.foldDensity?.phoneHeroColumnPad).toBe('0')
    expect(PARITY.foldDensity?.phoneHeroToFaceGapCancel).toBe(true)
    expect(PARITY.foldDensity?.titleStackOnPhone).toBe(true)
    expect(PAGE).toMatch(/<V3Breadcrumb trail=\{breadcrumbs\} tone="on-media" overlay \/>/)
  })

  it('uses the place trail and Atlas for this lot', () => {
    expect(PAGE).toMatch(/listingPlaceTrail/)
    expect(PAGE).toMatch(/listingAtlasHeadline/)
    expect(PAGE).toMatch(/<V3Atlas/)
    expect(PAGE).not.toMatch(/<ListingTourCard/)
    expect(PAGE).not.toMatch(/label: 'Home'/)
    expect(PAGE).not.toMatch(/label: 'Homes for sale'/)
  })

  it('routes similar-homes View more through the subdivision keep-exploring door', () => {
    expect(PAGE).toMatch(/listingKeepExploringDoor/)
    expect(PAGE).toMatch(/featuredViewAllHref = keepExploring\.href/)
    expect(PAGE).not.toMatch(/featuredViewAllHref[\s\S]{0,240}homesForSalePath/)
    expect(PAGE).not.toMatch(/featuredViewAllHref[\s\S]{0,240}subdivisionListingsPath/)
  })

  it('keeps a name-only other-subdivs rail for same-community siblings', () => {
    expect(PAGE).toMatch(/<V3PlaceIndex/)
    expect(PAGE).toMatch(/id="other-subdivs"/)
    expect(PAGE).toMatch(/nameOnly/)
    expect(PAGE).toMatch(/listingAtlas\.otherSubdivs/)
  })
})
