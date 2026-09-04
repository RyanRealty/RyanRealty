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

  it('keeps leftover median sold and sale-to-list', () => {
    expect(SRC).toMatch(/publicPaceItems\(publicPace\)/)
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
    expect(SRC).toMatch(/<PlaceFaceStrip stats=\{face\.stats\}/)
  })

  it('keeps MOS, sold, verdict, and DTP off the face', () => {
    expect(SRC).toMatch(/label === 'months of supply'/)
    expect(SRC).toMatch(/leftoverSoldHistoryFigures\(hud, publicPace\)/)
    expect(SRC).not.toMatch(/<PlaceFaceStrip[^>]*>[\s\S]{0,80}monthsOfSupply/)
    expect(SRC).not.toMatch(/publishPlaceFace\([\s\S]{0,120}grain: 'city'/)
    expect(SRC).toMatch(/monthsOfSupply:\s*null/)
    expect(SRC).toMatch(/The \$\{publicName\} market/)
    expect(SRC).not.toMatch(/has \$\{mosLabel\} months of supply/)
  })

  it('opens on Split, not V3Stage/V3Field as the cage', () => {
    expect(SRC).toMatch(/<PlaceSplitView/)
    expect(SRC).toMatch(/<V3Heading/)
    expect(SRC).not.toMatch(/headingLevel=\{1\}/)
    expect(SRC).toMatch(/overlaysFromChildCells\(platCells\)/)
    expect(SRC).toMatch(/id="homes"/)
    expect(SRC).toMatch(/seedRing=\{seedRing\}/)
    // seedRing keys on having a TRUSTED polygon (county plat-union first,
    // reliable stored boundary second) — not on hull reliability alone, which
    // left Black Butte Ranch's verified union undrawn (2026-09-01).
    expect(SRC).toMatch(/const seedRing = mapPolygon != null/)
    expect(SRC).not.toMatch(/<V3Stage/)
    expect(SRC).not.toMatch(/<V3Field/)
    expect(SRC).not.toMatch(/<CommunityStage/)
    expect(SRC).not.toMatch(/V3PlacePropertyTypes/)
  })

  it('never seeds an unreliable hull — only the plat union or a reliable boundary — and passes alias tiles', () => {
    expect(SRC).toMatch(/UNRELIABLE_BOUNDARY_SLUGS/)
    expect(SRC).toMatch(/isBoundaryReliable\(slug\)/)
    expect(SRC).toMatch(/!boundaryReliable && fieldTiles\.length > 0 \? communitySplitListings\(fieldTiles\)/)
    expect(SRC).toMatch(/resortBoundary \?\? \(boundaryReliable \? boundaryMapData\.polygon : null\)/)
    expect(SRC).toMatch(/boundaryGeojson=\{seedRing \? mapPolygon : null\}/)
    expect(SRC).toMatch(/foldAfter=\{5\}/)
    expect(SRC).toMatch(/startsWith\('at least'\)/)
    expect(SRC).not.toMatch(/id="place-about"/)
  })

  it('prints Redmond 2J for Eagle Crest and does not invent an elementary', () => {
    expect(SRC).toMatch(/getDistrictForCity\(slug === 'eagle-crest' \? 'Redmond' : cityName\)/)
    expect(SRC).not.toMatch(/elementarySchool/)
    expect(SRC).not.toMatch(/Elementary/)
  })

  it('uses one about paragraph and amenity blogs only', () => {
    expect(SRC).toMatch(/firstAboutParagraph\(aboutParagraphs\)/)
    expect(SRC).toMatch(/getBlogPostsBySlugs/)
    expect(SRC).not.toMatch(/getRecentBlogPosts/)
    expect(SRC).not.toMatch(/id="guides"/)
  })

  it('does not label first-screen copy with plat/nest/parent/child/sibling/CDP/Feeders', () => {
    expect(SRC).not.toMatch(/heading=\{belongingHeadline[\s\S]{0,200}\b(plat|nest|parent|child|sibling|CDP|Feeders)\b/)
    expect(SRC).not.toMatch(/body: faceAbout[\s\S]{0,80}\b(plat|nest|parent|child|sibling|CDP|Feeders)\b/)
  })
})
