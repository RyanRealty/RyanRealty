import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  BUILDER_FETCH_CAP,
  EXM7777_IDS,
  EXM7777_URLS,
  adaptedFromProblems,
  builderCard,
  catalogCoverageProblems,
  catalogInstallProblems,
  catalogReceiptProblems,
  demoStateSpecs,
  evaluatorBrief,
  formatBuilderCard,
  isHouseAdaptedId,
  optionListIds,
  replaceWithOptionProblems,
  resolveInstallSpec,
  layoutLockForClass,
  layoutLockProblems,
  listPicksForClass,
  loadTasteCatalog,
  modulesForClass,
  publicInstallForbidden,
  shadcnPicksForClass,
} from '../lib/taste-catalog.mjs'

const raw = JSON.parse(readFileSync('design_system/public/taste-catalog.json', 'utf8'))
const loaded = loadTasteCatalog(raw)

describe('loadTasteCatalog', () => {
  it('loads the committed catalog from the X post with all five EXM7777 sources', () => {
    expect(loaded.problems).toEqual([])
    expect(loaded.source).toBe('https://x.com/EXM7777/status/2092250905655812121')
    expect(loaded.catalogUrls).toEqual(expect.arrayContaining([...EXM7777_URLS]))
    expect(EXM7777_IDS.every((id) => loaded.catalogs.some((c) => c.id === id))).toBe(true)
    expect(loaded.catalogs.some((c) => c.id === 'house-v3' && c.kind === 'house')).toBe(true)
    expect(loaded.refuse.some((r) => /shadcn add/i.test(r))).toBe(true)
    expect(loaded.refuse.some((r) => /cream box/i.test(r) || /same interaction/i.test(r))).toBe(true)
  })
})

describe('listing-detail is the proof class', () => {
  it('locks the full-bleed hero and names the house modules a lane must keep', () => {
    const lock = layoutLockForClass(loaded, 'listing-detail')
    expect(lock).toMatch(/listing-hero-bleed/)
    expect(lock).toMatch(/SITE-45/)
    const ids = modulesForClass(loaded, 'listing-detail').map((m) => m.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'listing-hero-bleed',
        'listing-specs',
        'listing-ask',
        'shadcn-carousel',
        'beui-tabs',
        'transitions-modal',
        'beautifului-loading',
      ]),
    )
  })
})

describe('adaptedFromProblems', () => {
  it('refuses an empty adaptedFrom — that is inventing a layout', () => {
    const problems = adaptedFromProblems(loaded, 'listing-detail', [])
    expect(problems.some((p) => /empty/i.test(p))).toBe(true)
  })

  it('accepts a house module id from the class list', () => {
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'listing-hero-bleed' }])).toEqual([])
  })

  it('rejects a module that is not on the class list', () => {
    const problems = adaptedFromProblems(loaded, 'listing-detail', [{ id: 'fluid-orb' }])
    expect(problems.some((p) => /fluid-orb/.test(p))).toBe(true)
  })
})

describe('shadcn is the fetched list', () => {
  it('has the ui.shadcn.com catalog URL and 20+ named components', () => {
    expect(loaded.catalogUrl).toBe('https://ui.shadcn.com/docs/components')
    expect(loaded.shadcn.components.length).toBeGreaterThanOrEqual(20)
    const byName = Object.fromEntries(loaded.shadcn.components.map((c) => [c.name, c]))
    expect(byName.button.installed).toBe('components/ui/button.tsx')
    expect(byName.carousel.installed).toBe('components/ui/carousel.tsx')
    expect(byName['button-group'].installed).toBe('components/ui/button-group.tsx')
    expect(byName.carousel.docs).toBe('https://ui.shadcn.com/docs/components/carousel')
  })

  it('picks listing jobs from the list: carousel, button-group, sheet, dialog', () => {
    const names = shadcnPicksForClass(loaded, 'listing-detail').map((c) => c.name)
    expect(names).toEqual(expect.arrayContaining(['carousel', 'button-group', 'sheet', 'dialog']))
  })

  it('accepts a shadcn component name as adaptedFrom', () => {
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'shadcn:carousel' }])).toEqual([])
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'carousel' }])).toEqual([])
  })
})

describe('the other four EXM7777 catalogs', () => {
  it('picks takeable beui / transitions / beautifului modules for listing-detail', () => {
    const ids = listPicksForClass(loaded, 'listing-detail').map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['beui:tabs', 'transitions:modal-open', 'beautifului:loading-state']))
    expect(ids.some((id) => id.includes('fluid-orb'))).toBe(false)
  })

  it('accepts a beui module as adaptedFrom', () => {
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'beui:tabs' }])).toEqual([])
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'beui-tabs' }])).toEqual([])
  })
})

describe('publicInstallForbidden', () => {
  it('allows installing a catalog item, forbids dumping it onto app/ or a novelty kit', () => {
    expect(publicInstallForbidden('npx shadcn add @beui/morphing-search')).toBe(false)
    expect(publicInstallForbidden('npx shadcn add @beui/tilt-card')).toBe(true)
    expect(publicInstallForbidden('npx shadcn add carousel onto app/listing')).toBe(true)
    expect(publicInstallForbidden('adapt the tab indicator into V3Quiet')).toBe(false)
    expect(publicInstallForbidden('npx shadcn add carousel')).toBe(false)
  })
})

describe('the full EXM7777 inventories', () => {
  it('freezes the fetched lists, not a handful', () => {
    expect(loaded.lists.beui.components.length).toBeGreaterThanOrEqual(40)
    expect(loaded.lists.beautifului.components.length).toBeGreaterThanOrEqual(20)
    expect(loaded.lists.rareui.components.length).toBeGreaterThanOrEqual(15)
    expect(loaded.lists.transitions.components.length).toBeGreaterThanOrEqual(25)
    expect(loaded.shadcn.components.length).toBeGreaterThanOrEqual(50)
  })

  it('covers the public classes a lane actually builds', () => {
    expect(Object.keys(loaded.classes)).toEqual(
      expect.arrayContaining(['listing-detail', 'homepage-v6', 'search', 'sell', 'city']),
    )
    expect(loaded.classes['listing-detail'].primitivesToAdd).toEqual(
      expect.arrayContaining(['V3Carousel', 'V3ButtonGroup']),
    )
  })
})

describe('evaluatorBrief', () => {
  it('tells the judge to pick from named catalog jobs with demo URLs', () => {
    const brief = evaluatorBrief(loaded, 'listing-detail')
    expect(brief).toMatch(/listing-hero-bleed/)
    expect(brief).toMatch(/Frankenstein/)
    expect(brief).toMatch(/same interaction/)
    expect(brief).toMatch(/replaceWith/)
    expect(brief).toMatch(/SEO/)
    expect(brief).toMatch(/COMPREHENSIVE/)
    expect(brief.length).toBeLessThan(4500)
    expect(brief).toMatch(/https:\/\//)
    expect(brief).toMatch(/github.com\/starc007\/ui-components/)
    expect(brief).toMatch(/demoMatch/)
    expect(brief).toMatch(/Avatar import/)
    expect(brief).toMatch(/option list/)
  })

  it('accepts a new house primitive as adaptedFrom', () => {
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'V3Carousel' }])).toEqual([])
    expect(adaptedFromProblems(loaded, 'listing-detail', [{ id: 'V3ButtonGroup' }])).toEqual([])
  })
})

describe('builderCard', () => {
  it('caps remote fetches and opens house files, not the whole inventory', () => {
    const card = builderCard(loaded, 'listing-detail')
    expect(card.fetch.length).toBeLessThanOrEqual(BUILDER_FETCH_CAP)
    expect(card.open.map((o) => o.path)).toEqual(
      expect.arrayContaining([
        'components/site/listing-detail/ListingHero.tsx',
        'components/site/v3/V3Carousel.client.tsx',
        'components/site/v3/V3ButtonGroup.tsx',
      ]),
    )
    expect(card.add).toEqual([])
    const md = formatBuilderCard(card)
    expect(md).toMatch(/^# listing-detail/)
    expect(md).toMatch(/Open these house files/)
    expect(md).toMatch(/Fetch these catalog jobs/)
    expect(md).toMatch(/adaptedFrom/)
    expect(md).toMatch(/Comprehensive pass/)
    expect(md).toMatch(/demoMatch: true/)
  })

  it('CLI prints the builder card, not a JSON dump', () => {
    const r = spawnSync('node', ['scripts/lib/taste-catalog.mjs', 'listing-detail'], { encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/^# listing-detail/)
    expect(r.stdout).not.toMatch(/"shadcn":/)
  })

  it('CLI --preflight resolves routeClasses aliases (zip → city, team → team)', () => {
    const zip = spawnSync('node', ['scripts/lib/taste-catalog.mjs', 'zip', '--preflight'], { encoding: 'utf8' })
    expect(zip.status, zip.stderr).toBe(0)
    expect(zip.stdout).toMatch(/preflight OK/)
    const team = spawnSync('node', ['scripts/lib/taste-catalog.mjs', 'team', '--preflight'], { encoding: 'utf8' })
    expect(team.status, team.stderr).toBe(0)
    expect(team.stdout).toMatch(/preflight OK/)
  })
})

describe('catalogReceiptProblems', () => {
  it('refuses empty adaptedFrom and defects without replaceWith', () => {
    const empty = catalogReceiptProblems(loaded, 'listing-detail', { defects: [] })
    expect(empty.some((p) => /empty/i.test(p))).toBe(true)
    const named = catalogReceiptProblems(loaded, 'listing-detail', {
      adaptedFrom: [{ id: 'listing-hero-bleed' }],
      defects: [{ section: '#hero', finding: 'column frame instead of bleed' }],
    })
    expect(named.some((p) => /replaceWith/.test(p))).toBe(true)
    expect(
      catalogReceiptProblems(loaded, 'listing-detail', {
        adaptedFrom: [{ id: 'listing-hero-bleed' }],
        defects: [{ section: '#hero', finding: 'column frame instead of bleed', replaceWith: 'shadcn-carousel' }],
      }),
    ).toEqual([])
    expect(
      catalogReceiptProblems(loaded, 'listing-detail', {
        adaptedFrom: [{ id: 'listing-hero-bleed' }],
        defects: [{ section: '#copy', finding: 'unsourced figure in the fold', replaceWith: null }],
      }),
    ).toEqual([])
  })
})

describe('option list is the only legal replaceWith', () => {
  it('names house modules and catalog jobs the evaluator may pick', () => {
    const ids = optionListIds(loaded, 'homepage-v6')
    expect(ids.has('beui-morphing-search')).toBe(true)
    expect(ids.has('beui-tabs')).toBe(true)
    expect(ids.has('shadcn-carousel')).toBe(true)
    expect(ids.has('house-home-rails')).toBe(true)
    expect(ids.has('V3Pulse')).toBe(false)
  })

  it('refuses a house primitive that already lost (V3Pulse on home)', () => {
    const problems = replaceWithOptionProblems(loaded, 'homepage-v6', {
      defects: [
        {
          section: '#hero .v3-stage-band',
          finding: 'three-cell KPI strip',
          replaceWith: 'V3Pulse',
        },
      ],
    })
    expect(problems.some((p) => /V3Pulse/.test(p) && /option list/.test(p))).toBe(true)
  })

  it('accepts a catalog id from the card, or null for craft', () => {
    expect(
      replaceWithOptionProblems(loaded, 'homepage-v6', {
        defects: [
          { section: '#hero .v3-morph-search', finding: 'field never morphs', replaceWith: 'beui-morphing-search' },
          { section: '#hero .source', finding: 'muted cream on navy', replaceWith: null },
        ],
      }),
    ).toEqual([])
  })
})

describe('demoStates are the capture the evaluator can actually see', () => {
  it('prints a search-open spec for homepage so rest shots are not the only record', () => {
    const specs = demoStateSpecs(loaded, 'homepage-v6')
    expect(specs.some((s) => /search-open/.test(s) && /click/.test(s))).toBe(true)
  })
})

describe('layoutLockProblems', () => {
  it('flags a listing page that reintroduces heroInMain', () => {
    const files = {
      'app/listing/[listingKey]/page.tsx': 'export default function Page() { return <Shell heroInMain={true} /> }',
      'app/listing/by-address/[...slug]/page.tsx': 'export default function Page() { return <Shell /> }',
      'components/site/listing-detail/ListingDetailShell.tsx': '<section className="listing-hero-bleed">',
    }
    const problems = layoutLockProblems(loaded, {
      existsSync: (p) => p in files,
      readFileSync: (p) => files[p],
    })
    expect(problems.some((p) => /heroInMain/.test(p))).toBe(true)
  })

  it('passes the committed listing files', () => {
    expect(layoutLockProblems(loaded)).toEqual([])
  })

  it('fails About when AboutFaces or the proof roster returns', () => {
    const rogue = 'import { AboutFaces } from "./_v3/AboutFaces"\n<AboutFaces size="proof" />'
    const problems = layoutLockProblems(loaded, {
      existsSync,
      readFileSync: (p) => (p === 'app/about/page.tsx' ? rogue : readFileSync(p)),
    })
    expect(problems.some((p) => /<AboutFaces/.test(p))).toBe(true)
  })
})

describe('catalogInstallProblems', () => {
  it('resolves shadcn-carousel to the installed ui file', () => {
    const spec = resolveInstallSpec(loaded.installById, 'shadcn-carousel')
    expect(spec?.file).toBe('components/ui/carousel.tsx')
    expect(spec?.import).toBe('@/components/ui/carousel')
    expect(resolveInstallSpec(loaded.installById, 'shadcn:carousel')?.file).toBe(spec?.file)
    expect(isHouseAdaptedId('house-atlas')).toBe(true)
    expect(isHouseAdaptedId('beui-morphing-search')).toBe(false)
  })

  it('fails a catalog id whose house primitive does not import the installed file', () => {
    const problems = catalogInstallProblems(loaded, [{ id: 'shadcn-carousel' }], {
      existsSync: (p) => p === 'components/ui/carousel.tsx' || p === 'components/site/v3/V3Carousel.client.tsx',
      readFileSync: (p) =>
        p.endsWith('V3Carousel.client.tsx')
          ? 'export function V3Carousel() { return null }'
          : 'export function Carousel() { return null }',
    })
    expect(problems.some((p) => /must import/.test(p))).toBe(true)
  })

  it('passes when the house primitive imports the installed specifier', () => {
    const problems = catalogInstallProblems(loaded, [{ id: 'shadcn-carousel' }], {
      existsSync: (p) => p === 'components/ui/carousel.tsx' || p === 'components/site/v3/V3Carousel.client.tsx',
      readFileSync: (p) =>
        p.endsWith('V3Carousel.client.tsx')
          ? "import { Carousel } from '@/components/ui/carousel'\nexport function V3Carousel() { return <Carousel /> }"
          : 'export function Carousel() { return null }',
    })
    expect(problems).toEqual([])
  })

  it('refuses a catalog name with no install spec', () => {
    // beautifului-insight is installed (SITE-88); probe a name that is not.
    const problems = catalogInstallProblems(loaded, [{ id: 'beautifului-not-a-real-install' }])
    expect(problems.some((p) => /no install spec/.test(p))).toBe(true)
  })

  it('fails when the installed MorphingSearch is a house fork, not the beUI repo file', () => {
    const problems = catalogInstallProblems(loaded, [{ id: 'beui-morphing-search' }], {
      existsSync: (p) =>
        p === 'components/motion/morphing-search.tsx' || p === 'components/site/v3/V3MorphSearch.tsx',
      readFileSync: (p) =>
        p.endsWith('V3MorphSearch.tsx')
          ? "import { MorphingSearch } from '@/components/motion/morphing-search'\nexport function V3MorphSearch() { return <MorphingSearch items={[]} /> }"
          : 'export function MorphingSearch() { return <input /> }',
    })
    expect(problems.some((p) => /not the catalog source/.test(p))).toBe(true)
  })
})

describe('catalogCoverageProblems', () => {
  it('covers every public taste-classes key so a new SITE node has a builder card', () => {
    const keys = JSON.parse(readFileSync('design_system/public/taste-classes.json', 'utf8')).classes.map((c) => c.key)
    expect(catalogCoverageProblems(loaded, keys)).toEqual([])
  })

  it('names a taste class that has no catalog mapping', () => {
    const problems = catalogCoverageProblems(loaded, ['not-a-real-class'])
    expect(problems.some((p) => /not-a-real-class/.test(p))).toBe(true)
  })
})
