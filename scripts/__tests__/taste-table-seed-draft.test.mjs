import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSeedDrafts,
  collectUsedVersionGaps,
  FINISH_LINE,
  formatSeedDrafts,
  formatSiteGap,
  nextFreeSiteNumber,
} from '../lib/taste-table-core.mjs'
import { loadTasteCatalog } from '../lib/taste-catalog.mjs'
import { parseArgv } from '../taste-table.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLI = join(REPO, 'scripts/taste-table.mjs')
const CORE = join(REPO, 'scripts/lib/taste-table-core.mjs')

const SANDBOX = mkdtempSync(join(tmpdir(), 'rr-taste-seed-draft-'))
afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

function write(rel, contents = 'x') {
  const dest = join(SANDBOX, rel)
  mkdirSync(join(dest, '..'), { recursive: true })
  writeFileSync(dest, contents)
}

write('components/site/v3/V3Ledger.tsx')
write('components/site/v3/V3Quiet.tsx')

const existingPrimitive = 'components/site/v3/V3Ledger.tsx'
const goodDefect = {
  section: '#featured-cities',
  severity: 'taste',
  finding: 'a ledger row past six carries no visual encoding of magnitude',
  primitive: existingPrimitive,
}

function row(key, median, scores, extra = {}) {
  return {
    key,
    url: `/${key}`,
    route: `app/${key}/page.tsx`,
    median,
    scores,
    verdict: extra.verdict ?? `${key} is a cover memo, not a landing page.`,
    dullest: extra.dullest ?? `#${key} — empty first screen`,
    defects: extra.defects ?? [goodDefect],
  }
}

function tableWith(rows, instrument = { shotSpec: { viewports: [1440, 375], capture: 'first viewport', states: ['default'] } }) {
  return { evaluatedAt: '2026-09-10', instrument, rows }
}

const USED_THROUGH_62 = ['SITE-00', 'SITE-01', 'SITE-62', 'SITE-M1']

describe('parseArgv --seed-draft', () => {
  it('does not throw unknown option for --seed-draft or --seed-draft=', () => {
    expect(() => parseArgv(['--seed-draft'])).not.toThrow()
    expect(() => parseArgv(['--seed-draft=tmp/table.json'])).not.toThrow()
    expect(parseArgv(['--seed-draft'])).toMatchObject({ seedDraft: true, seedDraftPath: null })
    expect(parseArgv(['--seed-draft=tmp/table.json']).seedDraftPath).toBe('tmp/table.json')
  })
})

describe('version_gap numbering', () => {
  it('reads versionGap: SITE-… from a seed-file source and ignores SITE-M1 in the integer sequence', () => {
    const src = [
      "    versionGap: 'SITE-00',",
      '    versionGap: "SITE-62",',
      "    versionGap: 'SITE-M1',",
    ].join('\n')
    const used = collectUsedVersionGaps(src)
    expect(used).toEqual(['SITE-00', 'SITE-62', 'SITE-M1'])
    expect(nextFreeSiteNumber(used)).toBe(63)
    expect(formatSiteGap(63)).toBe('SITE-63')
    expect(formatSiteGap(1)).toBe('SITE-01')
  })

  it('used gaps including SITE-62 emit SITE-63 first, not SITE-1 and not SITE-62', () => {
    const { drafts } = buildSeedDrafts({
      table: tableWith([row('cities', 52, [50, 52, 54])]),
      usedGaps: USED_THROUGH_62,
      root: SANDBOX,
    })
    expect(drafts).toHaveLength(1)
    expect(drafts[0].versionGap).toBe('SITE-63')
    expect(drafts[0].versionGap).not.toBe('SITE-1')
    expect(drafts[0].versionGap).not.toBe('SITE-62')
  })
})

describe('buildSeedDrafts', () => {
  it('emits only classes whose median is under the finish line (52, not 70 or 81)', () => {
    const { drafts } = buildSeedDrafts({
      table: tableWith([
        row('about', 81, [80, 81, 82]),
        row('cities', 52, [50, 52, 54]),
        row('sell', 70, [68, 70, 72]),
      ]),
      usedGaps: USED_THROUGH_62,
      root: SANDBOX,
      finishLine: FINISH_LINE,
    })
    expect(drafts.map((d) => d.title.split(':')[0])).toEqual(['cities'])
    expect(drafts).toHaveLength(1)
    expect(drafts[0].objective).toMatch(/\b52\b/)
    expect(drafts[0].objective).not.toMatch(/\b70\b/)
    expect(drafts[0].objective).not.toMatch(/\b81\b/)
  })

  it('carries the median, three scores, and a defect primitive that exists on disk', () => {
    const { drafts } = buildSeedDrafts({
      table: tableWith([row('cities', 52, [50, 52, 54])]),
      usedGaps: USED_THROUGH_62,
      root: SANDBOX,
    })
    expect(drafts).toHaveLength(1)
    const d = drafts[0]
    expect(d.domain).toBe('public-ux')
    expect(d.objective).toMatch(/Class cities scored 52 \(50 · 52 · 54\)/)
    expect(d.objective).toContain(existingPrimitive)
    expect(d.objective).toMatch(/#featured-cities/)
    expect(d.accept).toMatch(/class cities scores above 52/)
    expect(d.accept).toMatch(/shotSpec/)
    expect(d.accept).toMatch(/1440/)
    expect(d.accept).toMatch(/Product hold/)
    expect(d.accept).toMatch(/honesty/)
  })

  it('two consecutive calls on the same table and used-gaps return the same versionGaps', () => {
    const table = tableWith([
      row('sell', 40, [39, 40, 41]),
      row('cities', 52, [50, 52, 54]),
    ])
    const a = buildSeedDrafts({ table, usedGaps: USED_THROUGH_62, root: SANDBOX })
    const b = buildSeedDrafts({ table, usedGaps: USED_THROUGH_62, root: SANDBOX })
    expect(a.drafts.map((d) => d.versionGap)).toEqual(b.drafts.map((d) => d.versionGap))
    expect(a.drafts.map((d) => d.versionGap)).toEqual(['SITE-63', 'SITE-64'])
  })

  it('extracts the file path from an annotated primitive field rather than skipping', () => {
    const annotated = {
      ...goodDefect,
      primitive: 'components/site/v3/V3Ledger.tsx (shared primitive — this defect ships on every page that uses it)',
    }
    const { drafts, warnings } = buildSeedDrafts({
      table: tableWith([row('cities', 52, [50, 52, 54], { defects: [annotated] })]),
      usedGaps: USED_THROUGH_62,
      root: SANDBOX,
    })
    expect(drafts).toHaveLength(1)
    expect(drafts[0].objective).toContain('components/site/v3/V3Ledger.tsx')
    expect(drafts[0].objective).not.toMatch(/shared primitive/)
    expect(warnings).toEqual([])
  })

  it('still emits when the evaluator marked the defect craft, as long as the primitive exists', () => {
    const craft = { ...goodDefect, severity: 'craft' }
    const { drafts } = buildSeedDrafts({
      table: tableWith([row('cities', 52, [50, 52, 54], { defects: [craft] })]),
      usedGaps: USED_THROUGH_62,
      root: SANDBOX,
    })
    expect(drafts).toHaveLength(1)
    expect(drafts[0].objective).toContain(existingPrimitive)
  })

  it('skips an under-line class whose defects name no primitive that exists, and does not invent one', () => {
    const dangling = {
      ...goodDefect,
      primitive: 'components/site/v3/DoesNotExist.tsx',
    }
    const { drafts, warnings } = buildSeedDrafts({
      table: tableWith([
        row('ghost', 12, [10, 12, 14], { defects: [dangling] }),
        row('cities', 52, [50, 52, 54]),
      ]),
      usedGaps: USED_THROUGH_62,
      root: SANDBOX,
    })
    expect(drafts.map((d) => d.versionGap)).toEqual(['SITE-63'])
    expect(drafts[0].title).toMatch(/^cities:/)
    expect(warnings.some((w) => w.includes('ghost') && /no defect names a primitive/i.test(w))).toBe(true)
    expect(JSON.stringify(drafts)).not.toContain('DoesNotExist')
  })

  it('formats a DRAFT banner that states this is not a Supabase write', () => {
    const { drafts } = buildSeedDrafts({
      table: tableWith([row('cities', 52, [50, 52, 54])]),
      usedGaps: USED_THROUGH_62,
      root: SANDBOX,
    })
    const text = formatSeedDrafts(drafts)
    expect(text).toMatch(/DRAFT/)
    expect(text).toMatch(/not seeded/i)
    expect(text).toMatch(/Nothing was written to Supabase/)
    expect(text).toMatch(/npx tsx scripts\/seed-site-queue\.ts/)
    expect(text).toMatch(/SITE-63/)
    expect(text).toMatch(/adaptedFrom/)
  })

  it('emits a class with no on-disk primitive when the catalog has modules, and requires adaptedFrom', () => {
    const catalog = loadTasteCatalog(
      JSON.parse(readFileSync(join(REPO, 'design_system/public/taste-catalog.json'), 'utf8')),
    )
    expect(catalog.problems).toEqual([])
    const dangling = {
      ...goodDefect,
      primitive: 'components/site/v3/DoesNotExist.tsx',
    }
    const { drafts, warnings } = buildSeedDrafts({
      table: tableWith([
        row('invest', 25, [24, 25, 26], {
          defects: [dangling],
          verdict: 'a cover memo, not a landing page.',
        }),
      ]),
      usedGaps: USED_THROUGH_62,
      root: SANDBOX,
      catalog,
    })
    expect(warnings).toEqual([])
    expect(drafts).toHaveLength(1)
    expect(drafts[0].versionGap).toBe('SITE-63')
    expect(drafts[0].objective).toMatch(/taste-catalog\.mjs invest --preflight/)
    expect(drafts[0].objective).toMatch(/adaptedFrom/)
    expect(drafts[0].objective).toMatch(/INSTALL/)
    expect(drafts[0].accept).toMatch(/adaptedFrom/)
    expect(drafts[0].accept).toMatch(/replaceWith/)
    expect(drafts[0].accept).toMatch(/demo match/)
    expect(drafts[0].accept).toMatch(/inventory/)
    expect(JSON.stringify(drafts)).not.toContain('DoesNotExist')
  })
})

describe('CLI --seed-draft (no network, no ui_kits write)', () => {
  it('does not import supabase, does not fetch the project URL, and does not write ui_kits or the committed table', () => {
    const toolSrc = `${readFileSync(CLI, 'utf8')}\n${readFileSync(CORE, 'utf8')}`
    expect(toolSrc).not.toMatch(/@supabase\/supabase-js/)
    expect(toolSrc).not.toMatch(/createClient/)

    const tmpTable = join(SANDBOX, 'table.json')
    writeFileSync(
      tmpTable,
      `${JSON.stringify(
        tableWith([
          row('cities', 52, [50, 52, 54], {
            defects: [
              {
                section: '#featured-cities',
                severity: 'taste',
                finding: 'a ledger row past six carries no visual encoding of magnitude',
                primitive: 'components/site/v3/V3Ledger.tsx',
              },
            ],
          }),
          row('sell', 70, [68, 70, 72]),
          row('about', 81, [80, 81, 82]),
        ]),
      )}\n`,
    )

    const porcelainBefore = spawnSync('git', ['status', '--porcelain', '--', 'design_system/ryan-realty/ui_kits', 'design_system/public/taste-table.json'], {
      cwd: REPO,
      encoding: 'utf8',
    }).stdout

    const env = { ...process.env }
    delete env.NEXT_PUBLIC_SUPABASE_URL
    delete env.SUPABASE_SERVICE_ROLE_KEY
    delete env.ANTHROPIC_API_KEY
    env.NEXT_PUBLIC_SUPABASE_URL = ''
    env.SUPABASE_SERVICE_ROLE_KEY = ''
    env.ANTHROPIC_API_KEY = ''

    const r = spawnSync(process.execPath, [CLI, `--seed-draft=${tmpTable}`], {
      cwd: REPO,
      encoding: 'utf8',
      env,
      timeout: 15000,
    })

    expect(r.status, r.stderr || r.stdout).toBe(0)
    expect(r.stdout).toMatch(/DRAFT/)
    expect(r.stdout).toMatch(/not seeded/i)
    expect(r.stdout).toMatch(/Nothing was written to Supabase/)
    expect(r.stdout).toMatch(/npx tsx scripts\/seed-site-queue\.ts/)
    expect(r.stdout).toMatch(/cities/)
    expect(r.stdout).toMatch(/\b52\b/)
    expect(r.stdout).toMatch(/50 · 52 · 54/)
    expect(r.stdout).toMatch(/components\/site\/v3\/V3Ledger\.tsx/)
    expect(r.stdout).not.toMatch(/\bsell:/)
    expect(r.stdout).not.toMatch(/\babout:/)
    expect(r.stderr + r.stdout).not.toMatch(/supabase\.co/i)

    const porcelainAfter = spawnSync('git', ['status', '--porcelain', '--', 'design_system/ryan-realty/ui_kits', 'design_system/public/taste-table.json'], {
      cwd: REPO,
      encoding: 'utf8',
    }).stdout
    expect(porcelainAfter).toBe(porcelainBefore)
  })
})
