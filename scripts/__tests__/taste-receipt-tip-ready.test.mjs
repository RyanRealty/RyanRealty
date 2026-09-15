import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHIP = join(REPO, 'scripts/lib/taste-receipt.mjs')
import {
  hasOpenStateEvidence,
  openStateEvidenceProblems,
  siteQueueDoneEvidenceProblems,
  tasteDoneProblems,
} from '../lib/taste-receipt.mjs'
import { catalogInstallProblems, tipReadyCatalogInstallProblems } from '../lib/catalog-install.mjs'

const ABOUT_BRIEF = {
  id: 'about-researchy-1-8',
  source: 'Researchy About beats 1–8',
  beats: [
    { id: '1', text: 'Firm story opens the page: since 2014, Bend office, who you call works your deal.' },
    { id: '2', text: 'Firm reviews: brokerage Google record as words (V3Proof), with a door to /reviews.' },
    { id: '3', text: 'Firm closings: recent Ryan Realty sales as house-row cards with recorded prices.' },
    { id: '4', text: 'Call is the primary conversion on the reach control, carrying live hours.' },
    { id: '5', text: 'Text sits on the same reach control as Call, not a seven-row phone book.' },
    { id: '6', text: 'Email sits on the same reach control as Call, Text, and Schedule.' },
    { id: '7', text: 'Schedule sits on the same reach control as Call, Text, and Email.' },
    { id: '8', text: 'Team teaser doors to /team (and /team/[slug]); inquiry doors to /contact.' },
  ],
}

/** Live About lock quotes — SITE-90 receipts cannot checkbox-pass without these. */
const ABOUT_LOCK_QUOTES = {
  '1': 'Ryan Realty is a boutique brokerage in Central Oregon that helps clients buy and sell their properties.',
  '2': 'The brokers are on /team. The person you talk to first is the person who works with you through closing.',
  '3': 'Hero (office exterior + purpose), V3Proof as first proof, closings,',
  '4': 'Call | Text | Email | Schedule. Live hours stay V3OnDuty above this.',
  '5': "street: '115 NW Oregon Ave #2'",
  '6': '5. AboutOffice — 115 NW Oregon Ave #2 + firm OREA. Brokers on /team only. * 6. AboutInquiry GET to /contact.',
  '7': '/about first viewport — Redfin structure. Navy and cream only.',
  '8': 'Firm closings as the shadcn carousel + Card demo (SITE-90).',
}

const catalog = {
  installById: {
    'shadcn-avatar': {
      file: 'components/ui/avatar.tsx',
      import: '@/components/ui/avatar',
      add: 'avatar',
      house: 'components/site/v3/V3Proof.client.tsx',
    },
  },
}

const passingIo = {
  existsSync: (p) =>
    p === 'components/ui/avatar.tsx' ||
    p === 'components/site/v3/V3Proof.client.tsx' ||
    p === 'app/about/page.tsx',
  readFileSync: (p) => {
    if (p === 'app/about/page.tsx') {
      return "import { Avatar } from '@/components/ui/avatar'\nexport const Page = Avatar\n"
    }
    if (p.endsWith('V3Proof.client.tsx')) {
      return "import { Avatar } from '@/components/ui/avatar'\nexport function V3Proof() { return <Avatar /> }\n"
    }
    return 'export function Avatar() { return null }\n'
  },
  scanFiles: ['app/about/page.tsx'],
}

function doneReceipt(over = {}) {
  return {
    demoMatch: true,
    competitiveBriefPass: true,
    evaluatorModel: 'grok-4.6',
    adaptedFrom: [{ id: 'shadcn-avatar' }, { id: 'house-faces' }],
    shots: { 'desktop-search-open': 'shots/search-open.png', desktop: 'shots/desktop.png' },
    shotSpec: { states: ['default', 'search-open'] },
    shotsHash: `sha256:${'a'.repeat(64)}`,
    competitiveBriefEvidence: { ...ABOUT_LOCK_QUOTES },
    ...over,
  }
}

describe('open-state evidence', () => {
  it('recognizes *-open / search-open shot keys and spec states', () => {
    expect(hasOpenStateEvidence({ shots: { 'desktop-search-open': 'shots/x.png' } })).toBe(true)
    expect(hasOpenStateEvidence({ shots: { desktop: 'ui_kits/about/shots/sheet-open.png' } })).toBe(true)
    expect(hasOpenStateEvidence({ shotSpec: { states: ['open'] } })).toBe(true)
    expect(hasOpenStateEvidence({ shots: { desktop: 'shots/desktop.png' }, shotSpec: { states: ['default'] } })).toBe(
      false,
    )
  })
})

describe('tasteDoneProblems — Tip Ready open-state + catalog-install', () => {
  it('PASSES with demoMatch true + competitiveBriefPass true + open shot + real adaptedFrom import', () => {
    expect(
      tasteDoneProblems(doneReceipt(), {
        competitiveBrief: ABOUT_BRIEF,
        catalog,
        route: 'app/about/page.tsx',
        catalogIo: passingIo,
      }),
    ).toEqual([])
  })

  it('FAILS cream-box adaptedFrom without open shot', () => {
    const p = tasteDoneProblems(
      doneReceipt({
        shots: { desktop: 'shots/desktop.png', mobile375: 'shots/mobile375.png' },
        shotSpec: { states: ['default'] },
      }),
      {
        competitiveBrief: ABOUT_BRIEF,
        catalog,
        route: 'app/about/page.tsx',
        catalogIo: passingIo,
      },
    )
    expect(p.join('\n')).toMatch(/open-state evidence/)
    expect(p.join('\n')).toMatch(/\*-open/)
  })

  it('FAILS adaptedFrom catalog id with demoMatch false', () => {
    const p = tasteDoneProblems(doneReceipt({ demoMatch: false }), {
      competitiveBrief: ABOUT_BRIEF,
      catalog,
      route: 'app/about/page.tsx',
      catalogIo: passingIo,
    })
    expect(p.join('\n')).toMatch(/demoMatch is false/)
    expect(p.join('\n')).toMatch(/adaptedFrom names catalog modules/)
  })

  it('FAILS when only the house primitive imports the catalog (route does not)', () => {
    const p = tasteDoneProblems(doneReceipt(), {
      competitiveBrief: ABOUT_BRIEF,
      catalog,
      route: 'app/about/page.tsx',
      catalogIo: {
        existsSync: passingIo.existsSync,
        readFileSync: (p) => {
          if (p === 'app/about/page.tsx') {
            return "import { V3Doors } from '@/components/site/v3'\nexport const Page = V3Doors\n"
          }
          return passingIo.readFileSync(p)
        },
        scanFiles: ['app/about/page.tsx'],
      },
    })
    expect(p.join('\n')).toMatch(/route page\/v3 files must import/)
    expect(p.join('\n')).toMatch(/House-only import is not Tip Ready/)
  })
})

describe('catalogInstallProblems — requireRouteImport', () => {
  it('still passes ci:catalog-install when only spec.house imports (no requireRouteImport)', () => {
    const problems = catalogInstallProblems(catalog, [{ id: 'shadcn-avatar' }], {
      existsSync: passingIo.existsSync,
      readFileSync: passingIo.readFileSync,
    })
    expect(problems).toEqual([])
  })

  it('Tip Ready wrapper refuses house-only import', () => {
    const p = tipReadyCatalogInstallProblems([{ id: 'shadcn-avatar' }], {
      catalog,
      route: 'app/about/page.tsx',
      catalogIo: {
        existsSync: passingIo.existsSync,
        readFileSync: (p) =>
          p === 'app/about/page.tsx'
            ? 'export const Page = () => null\n'
            : passingIo.readFileSync(p),
        scanFiles: ['app/about/page.tsx'],
      },
    })
    expect(p.join('\n')).toMatch(/House-only import is not Tip Ready/)
  })
})

describe('openStateEvidenceProblems', () => {
  it('is silent for house-only adaptedFrom', () => {
    expect(
      openStateEvidenceProblems({
        adaptedFrom: [{ id: 'house-atlas' }, { id: 'V3Proof' }],
        shots: { desktop: 'shots/desktop.png' },
      }),
    ).toEqual([])
  })
})

describe('siteQueueDoneEvidenceProblems — Tip Ready language without --ship', () => {
  it('refuses Tip Ready prose when --ship / ship OK is missing', () => {
    const p = siteQueueDoneEvidenceProblems(
      'npx tsx scripts/taste-evaluate.ts about — grok-4.6 demoMatch: true, competitiveBriefPass: true, median 71. Tip Ready.',
      {
        versionGap: 'SITE-90',
        tasteReview: {
          competitiveBriefPass: true,
          demoMatch: true,
          evaluatorModel: 'grok-4.6',
          shotsHash: `sha256:${'a'.repeat(64)}`,
          competitiveBriefEvidence: { ...ABOUT_LOCK_QUOTES },
        },
      },
    )
    expect(p.join('\n')).toMatch(/--ship/)
    expect(p.join('\n')).toMatch(/Cos prose is not Tip Ready/)
  })

  it('passes when evidence records --ship exit 0', () => {
    expect(
      siteQueueDoneEvidenceProblems(
        'node scripts/lib/taste-receipt.mjs --ship design_system/ryan-realty/ui_kits/about/parity.json → ship OK. grok-4.6 demoMatch: true, competitiveBriefPass: true.',
        {
          versionGap: 'SITE-90',
          tasteReview: {
            competitiveBriefPass: true,
            demoMatch: true,
            evaluatorModel: 'grok-4.6',
            shotsHash: `sha256:${'a'.repeat(64)}`,
            competitiveBriefEvidence: { ...ABOUT_LOCK_QUOTES },
          },
        },
      ),
    ).toEqual([])
  })
})

describe('taste-receipt --ship CLI', () => {
  it('exits 1 on a cream-box receipt with no open shot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-ship-'))
    mkdirSync(join(dir, 'design_system/public'), { recursive: true })
    writeFileSync(
      join(dir, 'design_system/public/taste-catalog.json'),
      JSON.stringify({
        installById: {
          'shadcn-avatar': {
            file: 'components/ui/avatar.tsx',
            import: '@/components/ui/avatar',
            add: 'avatar',
          },
        },
      }),
    )
    writeFileSync(
      join(dir, 'parity.json'),
      JSON.stringify({
        route: 'app/about/page.tsx',
        competitiveBrief: ABOUT_BRIEF,
        tasteReview: doneReceipt({
          shots: { desktop: 'shots/desktop.png' },
          shotSpec: { states: ['default'] },
        }),
      }),
    )
    const r = spawnSync(process.execPath, [SHIP, '--ship', 'parity.json'], {
      cwd: dir,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(1)
    expect(`${r.stderr}${r.stdout}`).toMatch(/open-state evidence|demoMatch|catalog/)
  })

  it('SITE-94 community parity --ship exits 0', () => {
    const r = spawnSync(
      process.execPath,
      [SHIP, '--ship', 'design_system/ryan-realty/ui_kits/community/parity.json'],
      { cwd: REPO, encoding: 'utf8', env: process.env },
    )
    expect(r.status).toBe(0)
    expect(`${r.stdout}${r.stderr}`).toMatch(/ship OK/)
    expect(`${r.stdout}${r.stderr}`).toMatch(/demoMatch true/)
    expect(`${r.stdout}${r.stderr}`).toMatch(/open-state/)
    expect(`${r.stdout}${r.stderr}`).toMatch(/catalog-install/)
  })
})
