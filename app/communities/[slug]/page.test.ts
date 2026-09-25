import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8')

describe('community page leftover 12-month sold overlay', () => {
  it('assigns HUD sold12mo and FAQ soldCount12mo from leftover closedCount', () => {
    expect(SRC).toMatch(/getPublicDetachedPace/)
    expect(SRC).toMatch(/leftoverHudKpis/)
    expect(SRC).toMatch(/leftoverMarketFigures/)
    expect(SRC).toMatch(/soldCount12mo:\s*publicPace\.closedCount/)
  })

  it('does not assign those figures from cache soldCount', () => {
    expect(SRC).not.toMatch(/sold12mo:[\s\S]{0,80}stats\?\.soldCount/)
    expect(SRC).not.toMatch(/soldCount12mo:[\s\S]{0,80}stats\?\.soldCount/)
    expect(SRC).not.toMatch(/stats\?\.soldCount/)
  })

  it('keeps leftover median sold as the folded cost figures', () => {
    expect(SRC).toMatch(/leftoverSoldHistoryFigures\(hud, publicPace\)/)
    expect(SRC).toMatch(/leftoverHudKpis/)
    expect(SRC).toMatch(/leftoverMarketFigures/)
  })

  it('does not map leftover daysToContract onto median DOM', () => {
    expect(SRC).not.toMatch(/medianDom12mo:/)
    expect(SRC).not.toMatch(/medianDom12mo:[\s\S]{0,80}daysToContract/)
    expect(SRC).not.toMatch(/medianDom12mo:[\s\S]{0,80}publicPace\.daysToContract/)
  })
})

describe('community first screen leftover face + split', () => {
  it('keeps leftover HUD at neighborhood grain keyed by the bare slug', () => {
    expect(SRC).toMatch(/leftoverHudKpis\(\{\s*grain: 'neighborhood'/)
    expect(SRC).toMatch(/geoType: 'neighborhood',\s*geoSlug: neighborhoodSlug/)
  })

  it('face uses leftover active, not alias Field length', () => {
    expect(SRC).toMatch(/publishPlaceFace\(\{\s*grain: 'community',\s*hud\s*\}\)/)
    expect(SRC).not.toMatch(/publishPlaceFace\([\s\S]{0,200}active:/)
    expect(SRC).not.toMatch(/active:\s*aliasAwareCount/)
    expect(SRC).not.toMatch(/active:\s*fieldItems\.length/)
    expect(SRC).not.toMatch(/active:\s*listedCount/)
    expect(SRC).not.toMatch(/<PlaceFaceStrip/)
  })

  it('keeps MOS, sold, verdict, and DTP off the face', () => {
    expect(SRC).toMatch(/label === 'months of supply'/)
    expect(SRC).toMatch(/leftoverSoldHistoryFigures\(hud, publicPace\)/)
    expect(SRC).not.toMatch(/<PlaceFaceStrip[^>]*>[\s\S]{0,80}monthsOfSupply/)
    expect(SRC).not.toMatch(/publishPlaceFace\([\s\S]{0,120}grain: 'city'/)
    expect(SRC).toMatch(/monthsOfSupply:\s*null/)
    expect(SRC).toMatch(/Typical price in \$\{publicName\}/)
    expect(SRC).not.toMatch(/has \$\{mosLabel\} months of supply/)
  })

  it('opens on typed on-page inventory, not V3Stage/V3Field as the cage', () => {
    expect(SRC).toMatch(/<PlaceSubdivisionHomes/)
    expect(SRC).not.toMatch(/<PlaceSplitView/)
    expect(SRC).not.toMatch(/<PlaceTypeSlider/)
    expect(SRC).toMatch(/<V3Heading/)
    expect(SRC).not.toMatch(/headingLevel=\{1\}/)
    expect(SRC).toMatch(/id="homes"/)
    expect(SRC).toMatch(/const liveStockTiles = population\.tiles/)
    expect(SRC).toMatch(/placeStockSectionsFromTiles/)
    expect(SRC).toMatch(/community-field-types/)
    expect(SRC).toMatch(/loadCommunitySerpStock/)
    expect(SRC).toMatch(/belongingHeadline\(/)
    expect(SRC).toMatch(/\{headline\}/)
    // seedRing keys on having a TRUSTED outline: the stored row, keyed by the
    // registry and passed by the one trust rule (2026-09-25).
    expect(SRC).toMatch(/const seedRing = mapPolygon != null/)
    expect(SRC).not.toMatch(/<V3Stage/)
    expect(SRC).not.toMatch(/<V3Field/)
    expect(SRC).not.toMatch(/<CommunityStage/)
    expect(SRC).not.toMatch(/V3PlacePropertyTypes/)
    expect(SRC).not.toMatch(/every home for sale in/i)
  })

  it('never seeds an untrusted outline, and keeps stock on-page', () => {
    // ONE outline (the stored row keyed by the registry entry, never the URL)
    // and ONE trust decision, which the homes list obeys too.
    expect(SRC).toMatch(/communityOutlineRef\(registryEntry\.slug\)/)
    expect(SRC).toMatch(/const mapPolygon = population\.outline/)
    expect(SRC).not.toMatch(/getResortBoundaryGeoJSON/)
    expect(SRC).not.toMatch(/boundarySanityBaseline/)
    expect(SRC).not.toMatch(/geoSlug: slug \}/)
    expect(SRC).toMatch(/href: '#homes'/)
    expect(SRC).toMatch(/belongingCaption\(/)
    expect(SRC).toMatch(/belongingFigures\(richContent, placeCharacter\)/)
    expect(SRC).not.toMatch(/id="facts"/)
    expect(SRC).toMatch(/chartFirst/)
    expect(SRC).toMatch(/foldAfter=\{0\}/)
    expect(SRC).not.toMatch(/tooFewSalesItems/)
    expect(SRC).toMatch(/costChart && firstMarketFigure/)
    expect(SRC).not.toMatch(/id="place-about"/)
  })

  it('prints Redmond 2J for Eagle Crest and does not invent an elementary', () => {
    expect(SRC).toMatch(/getDistrictForCity\(slug === 'eagle-crest' \? 'Redmond' : cityName\)/)
    expect(SRC).not.toMatch(/elementarySchool/)
    expect(SRC).not.toMatch(/Elementary/)
  })

  it('uses one about paragraph and amenity blogs only', () => {
    expect(SRC).toMatch(/firstAboutParagraph\(aboutParagraphs\)/)
    expect(SRC).not.toMatch(/getBlogPostsBySlugs/)
    expect(SRC).not.toMatch(/getRecentBlogPosts/)
    // 2026-09-07: id="guides" is the one area-guide door to the Ryan Realty
    // YouTube channel (areaGuideRow), below the fold. Still no recent-posts feed.
    expect(SRC).toMatch(/id="guides"/)
    expect(SRC).toMatch(/areaGuideRow\(publicName, areaGuideVideo\)/)
  })

  it('does not label first-screen copy with plat/nest/parent/child/sibling/CDP/Feeders', () => {
    expect(SRC).not.toMatch(/heading=\{belongingHeadline[\s\S]{0,200}\b(plat|nest|parent|child|sibling|CDP|Feeders)\b/)
    expect(SRC).not.toMatch(/body: faceAbout[\s\S]{0,80}\b(plat|nest|parent|child|sibling|CDP|Feeders)\b/)
  })

  it('does not put an em dash in the atlas claim (Matt lock 2026-09-20)', () => {
    expect(SRC).not.toMatch(/claimText=/)
    expect(SRC).not.toMatch(/every active and pending/)
  })
})

describe('community map and homes: one for-sale population (2026-09-25)', () => {
  it('reads the population once and hands the SAME population to the homes list and the map', () => {
    expect(SRC).toMatch(/getCommunityPopulation\(slug\)/)
    expect(SRC.match(/getCommunityPopulation\(/g) ?? []).toHaveLength(1)
    // Homes: the population's tiles, nothing else.
    expect(SRC).toMatch(/const liveStockTiles = population\.tiles/)
    expect(SRC).not.toMatch(/loadPlaceStockTiles\(/)
    // Map: the population's outline, and its on-market dots are the population.
    expect(SRC).toMatch(/const mapPolygon = population\.outline/)
    expect(SRC).toMatch(/onMarket: population\.atlasTiles/)
    // The dots route rebuilds the SAME population from the page's own reference.
    expect(SRC).toMatch(/boundaryRef: mapPolygon \? \{ kind: 'community', slug \} : null/)
  })

  it('draws a community with no outline from exactly its listed keys (recorded plats only, Matt 2026-09-25)', () => {
    expect(SRC).toMatch(/const atlasKeys = mapPolygon \? null : population\.atlasTiles\.map/)
    expect(SRC).toMatch(/listingKeys: atlasKeys \?\? \[\], label: publicName, onMarket: population\.atlasTiles/)
    expect(SRC).toMatch(/const listedCount = placeHomes\.length/)
    expect(SRC).toMatch(/countIsAliasAware: aliasAwareCount != null && population\.countsMlsNames/)
    expect(SRC).not.toMatch(/fieldTiles/)
  })

  it('keys every outline read by the registry entry, gated by the one trust rule', () => {
    expect(SRC).toMatch(/getCommunitySubdivisions\(\{ geoType: 'neighborhood', geoSlug: trustedOutlineSlug \}\)/)
    expect(SRC).toMatch(/getPlaceSchools\('neighborhood', trustedOutlineSlug\)/)
    expect(SRC).not.toMatch(/getGeoBoundaryMapData\(/)
  })
})
