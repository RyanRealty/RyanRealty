import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildRow,
  builderModelFromCommitBody,
  computeDiff,
  criteriaProblems,
  defectExists,
  demoMatchCell,
  demoMatchVerdict,
  droppedClasses,
  escapesRepo,
  filterClasses,
  loadClassRegistry,
  median3,
  primitiveNamedMost,
  regenerateMarkdownSection,
  renderMarkdownTable,
  sameModelWarning,
  selectMedianScoring,
  TASTE_TABLE_END,
  TASTE_TABLE_START,
} from '../lib/taste-table-core.mjs'
import { JudgeOutError, grokLinkOrder, judgeIsOut, parseArgv, parseEvaluatorJson } from '../taste-table.mjs'

describe('judgeIsOut — a judge that is out is not a malformed answer', () => {
  it('402 (quota, weekly limit) and a missing CLI stop the run', () => {
    expect(judgeIsOut(Object.assign(new Error('weekly limit'), { kind: '402' }))).toBe(true)
    expect(judgeIsOut(Object.assign(new Error('no grok CLI'), { kind: 'missing' }))).toBe(true)
  })
  it('a real error (bad JSON, token limit, exit 1) is retried per class as before', () => {
    expect(judgeIsOut(Object.assign(new Error('exited 1'), { kind: 'error' }))).toBe(false)
    expect(judgeIsOut(new Error('no kind'))).toBe(false)
    expect(judgeIsOut(null)).toBe(false)
  })
  it('JudgeOutError carries the kind the resume message prints', () => {
    const err = new JudgeOutError("You've hit your weekly limit", '402')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('JudgeOutError')
    expect(err.kind).toBe('402')
    expect(err.message).toMatch(/weekly limit/)
  })
})

// A disposable sandbox so "does this primitive exist on disk" tests do not
// depend on the real repo tree (and never touch it).
const SANDBOX = mkdtempSync(join(tmpdir(), 'rr-taste-table-'))
afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

function write(rel, contents = 'x') {
  const dest = join(SANDBOX, rel)
  mkdirSync(join(dest, '..'), { recursive: true })
  writeFileSync(dest, contents)
}

write('components/site/v3/V3Ledger.tsx')
write('app/cities/page.tsx')
write('app/housing-market/[...slug]/page.tsx')

describe('escapesRepo + defectExists', () => {
  it('a Next.js catch-all segment is a path, not a traversal', () => {
    expect(escapesRepo('app/housing-market/[...slug]/page.tsx')).toBe(false)
    expect(defectExists({ ...goodDefect, primitive: 'app/housing-market/[...slug]/page.tsx' }, SANDBOX)).toBe(true)
  })
  it('a .. segment, an absolute path, or a drive letter escapes the repo', () => {
    expect(escapesRepo('../etc/passwd')).toBe(true)
    expect(escapesRepo('app/../../x.tsx')).toBe(true)
    expect(escapesRepo('/etc/passwd')).toBe(true)
    expect(escapesRepo('C:\\x\\y.tsx')).toBe(true)
    expect(defectExists({ ...goodDefect, primitive: 'app/cities/../cities/page.tsx' }, SANDBOX)).toBe(false)
  })
  it('a dotted file name is fine; a missing file is not', () => {
    expect(escapesRepo('components/site/v3/V3Ledger.client.tsx')).toBe(false)
    expect(defectExists({ ...goodDefect, primitive: 'components/site/v3/Missing.tsx' }, SANDBOX)).toBe(false)
  })
})

const goodDefect = {
  section: '#featured-cities',
  severity: 'taste',
  finding: 'a ledger row past six carries no visual encoding of magnitude',
  primitive: 'components/site/v3/V3Ledger.tsx',
}
const goodCriteria = { designQuality: 10, originality: 8, interaction: 3, craft: 7, honestyFunction: 2 }
const goodScoring = (score, criteria = goodCriteria) => ({
  score,
  criteria,
  tells: ['Scrolling lists as the design.'],
  defects: [goodDefect],
  dullest: 'the whole list',
  beats: 'No win named',
  verdict: 'A table wearing hairlines.',
  demoMatch: false,
})

// ---------------------------------------------------------------------------
// median + criteria validation
// ---------------------------------------------------------------------------

describe('median3 + criteriaProblems', () => {
  it('takes the middle of three integers', () => {
    expect(median3([33, 29, 30])).toBe(30)
    expect(median3([25, 19, 29])).toBe(25)
  })

  it('refuses anything but exactly three 0-100 integers', () => {
    expect(median3([1, 2])).toBeNull()
    expect(median3([1, 2, 3, 4])).toBeNull()
    expect(median3([1, 2.5, 3])).toBeNull()
    expect(median3([-1, 2, 3])).toBeNull()
    expect(median3([1, 2, 101])).toBeNull()
  })

  it('passes when the five criteria sum to the score', () => {
    expect(criteriaProblems(goodCriteria, 30)).toEqual([])
  })

  it('flags a criterion over its weight', () => {
    const problems = criteriaProblems({ ...goodCriteria, interaction: 20 }, 37)
    expect(problems.some((p) => p.includes('criteria.interaction'))).toBe(true)
  })

  it('flags a sum that does not equal the score', () => {
    const problems = criteriaProblems(goodCriteria, 31)
    expect(problems.some((p) => p.includes('sums to 30, not the score 31'))).toBe(true)
  })

  it('flags a missing criteria object', () => {
    expect(criteriaProblems(null, 30)[0]).toMatch(/missing or not an object/)
  })
})

// ---------------------------------------------------------------------------
// the median-scoring selection
// ---------------------------------------------------------------------------

describe('selectMedianScoring', () => {
  it('picks the scoring object whose score equals the median', () => {
    const scorings = [goodScoring(33), goodScoring(29), goodScoring(30)]
    const { median, picked } = selectMedianScoring(scorings)
    expect(median).toBe(30)
    expect(picked.score).toBe(30)
  })

  it('picks the FIRST match when two scorings tie at the median value', () => {
    const low = goodScoring(20)
    const midA = { ...goodScoring(30), dullest: 'first 30' }
    const midB = { ...goodScoring(30), dullest: 'second 30' }
    const { median, picked } = selectMedianScoring([low, midA, midB])
    expect(median).toBe(30)
    expect(picked.dullest).toBe('first 30')
  })

  it('returns null when fewer or more than three scorings are given', () => {
    expect(selectMedianScoring([goodScoring(30), goodScoring(31)]).median).toBeNull()
  })

  it('returns null when a scoring failed to parse (score: null)', () => {
    const scorings = [goodScoring(30), { score: null }, goodScoring(29)]
    expect(selectMedianScoring(scorings).median).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildRow — defects must name a primitive that exists on disk
// ---------------------------------------------------------------------------

describe('buildRow', () => {
  it('builds a valid row when every check passes', () => {
    const scorings = [goodScoring(33), goodScoring(29), goodScoring(30)]
    const { row, problems } = buildRow({
      key: 'cities',
      url: '/cities',
      route: 'app/cities/page.tsx',
      scorings,
      builderModel: 'claude-fable-5-1',
      shots: { desktop: 'cities/desktop.png', mobile375: 'cities/mobile375.png' },
      root: SANDBOX,
    })
    expect(problems).toEqual([])
    expect(row.median).toBe(30)
    expect(row.defects).toHaveLength(1)
    expect(row.invalid).toBeUndefined()
  })

  it('drops a defect whose primitive does not exist, and marks the row invalid when none survive', () => {
    const badDefect = { ...goodDefect, primitive: 'components/site/v3/DoesNotExist.tsx' }
    const scorings = [goodScoring(33), { ...goodScoring(29), defects: [badDefect] }, goodScoring(30)]
    // Force the median scoring (30, index 2) to carry only the dangling defect.
    scorings[2] = { ...goodScoring(30), defects: [badDefect] }
    const { row, problems } = buildRow({
      key: 'cities',
      url: '/cities',
      route: 'app/cities/page.tsx',
      scorings,
      builderModel: 'unknown',
      shots: { desktop: 'cities/desktop.png', mobile375: 'cities/mobile375.png' },
      root: SANDBOX,
    })
    expect(row.defects).toEqual([])
    expect(problems.length).toBeGreaterThan(0)
    expect(row.invalid).toMatch(/no defect names a primitive/)
  })

  it('marks the row invalid when the three scores have no median (bad input)', () => {
    const { row, problems } = buildRow({
      key: 'cities',
      url: '/cities',
      route: 'app/cities/page.tsx',
      scorings: [goodScoring(30), goodScoring(31)],
      builderModel: 'unknown',
      shots: {},
      root: SANDBOX,
    })
    expect(problems.length).toBeGreaterThan(0)
    expect(row.invalid).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// demoMatch on the row + shotsHash binding (Matt 2026-09-12: "no gaps")
// ---------------------------------------------------------------------------

describe('demoMatchVerdict — the table keeps what the rubric required', () => {
  it('is the majority of three verdicts, votes kept beside it', () => {
    expect(demoMatchVerdict([{ demoMatch: true }, { demoMatch: false }, { demoMatch: true }])).toEqual({ verdict: true, votes: [true, false, true] })
    expect(demoMatchVerdict([{ demoMatch: false }, { demoMatch: false }, { demoMatch: true }])).toEqual({ verdict: false, votes: [false, false, true] })
  })
  it('is null when fewer than two scorings answered, or two split', () => {
    expect(demoMatchVerdict([{ demoMatch: true }, {}, { score: 1 }]).verdict).toBeNull()
    expect(demoMatchVerdict([{ demoMatch: true }, { demoMatch: false }, {}]).verdict).toBeNull()
    expect(demoMatchVerdict([{ demoMatch: true }, { demoMatch: true }, {}]).verdict).toBe(true)
  })
  it('never invents a verdict from a non-boolean', () => {
    expect(demoMatchVerdict([{ demoMatch: 'true' }, { demoMatch: 1 }, { demoMatch: null }])).toEqual({ verdict: null, votes: [null, null, null] })
  })
})

describe('buildRow — demoMatch and shotsHash on the row', () => {
  const RUN = 'run-a'
  mkdirSync(join(SANDBOX, RUN, 'cities'), { recursive: true })
  writeFileSync(join(SANDBOX, RUN, 'cities', 'desktop.png'), 'desktop-bytes')
  writeFileSync(join(SANDBOX, RUN, 'cities', 'mobile375.png'), 'mobile-bytes')
  const base = {
    key: 'cities',
    url: '/cities',
    route: 'app/cities/page.tsx',
    builderModel: 'claude-fable-5-1',
    shots: { desktop: 'cities/desktop.png', mobile375: 'cities/mobile375.png' },
    root: SANDBOX,
  }

  it('records the majority demoMatch, the votes, the runDir and a sha256 over the two shots', () => {
    const scorings = [{ ...goodScoring(33), demoMatch: true }, goodScoring(29), { ...goodScoring(30), demoMatch: true }]
    const { row, problems } = buildRow({ ...base, scorings, runDir: RUN })
    expect(problems).toEqual([])
    expect(row.demoMatch).toBe(true)
    expect(row.demoMatchVotes).toEqual([true, false, true])
    expect(row.runDir).toBe(RUN)
    expect(row.shotsHash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
  it('the hash changes when a shot changes — the old median stops being that picture', () => {
    const scorings = [goodScoring(33), goodScoring(29), goodScoring(30)]
    const a = buildRow({ ...base, scorings, runDir: RUN }).row.shotsHash
    writeFileSync(join(SANDBOX, RUN, 'cities', 'mobile375.png'), 'mobile-bytes-v2')
    const b = buildRow({ ...base, scorings, runDir: RUN }).row.shotsHash
    expect(a).not.toBe(b)
  })
  it('is invalid when a scoring left demoMatch out — the rubric requires it on every one', () => {
    const scorings = [{ ...goodScoring(33), demoMatch: undefined }, { ...goodScoring(29), demoMatch: undefined }, goodScoring(30)]
    const { row, problems } = buildRow({ ...base, scorings, runDir: RUN })
    expect(row.demoMatch).toBeNull()
    expect(problems.join(' ')).toMatch(/demoMatch was answered on 1\/3/)
    expect(row.invalid).toMatch(/demoMatch/)
  })
  it('is invalid when the shots under runDir are not on disk', () => {
    const scorings = [goodScoring(33), goodScoring(29), goodScoring(30)]
    const { row, problems } = buildRow({ ...base, scorings, runDir: 'run-that-never-existed' })
    expect(row.shotsHash).toBeNull()
    expect(problems.join(' ')).toMatch(/not on disk/)
  })
  it('without a runDir (legacy caller) records no hash and does not complain about it', () => {
    const scorings = [goodScoring(33), goodScoring(29), goodScoring(30)]
    const { row, problems } = buildRow({ ...base, scorings })
    expect(row.runDir).toBeNull()
    expect(row.shotsHash).toBeNull()
    expect(problems).toEqual([])
  })
})

describe('renderMarkdownTable — the demo column', () => {
  it('shows yes / NO / split / not recorded from the row', () => {
    expect(demoMatchCell({ demoMatch: true })).toBe('yes')
    expect(demoMatchCell({ demoMatch: false })).toBe('**NO**')
    expect(demoMatchCell({ demoMatch: null, demoMatchVotes: [true, false, null] })).toBe('split')
    expect(demoMatchCell({ median: 50 })).toBe('not recorded')
  })
  it('puts the column between scores and DQ', () => {
    const block = renderMarkdownTable([{ key: 'cities', median: 50, scores: [49, 50, 51], demoMatch: false, criteria: goodCriteria, tells: [], defects: [], verdict: 'x' }], {
      evaluatedAt: '2026-09-13',
      instrument: { evaluatorModel: 'claude-sonnet-5', rubricVersion: 'v1-2026-09-12' },
    })
    expect(block).toContain('| class | median | scores | demo | DQ/30 |')
    expect(block).toContain('| cities | **50** | 49 · 50 · 51 | **NO** | ')
  })
})

describe('sameModelWarning', () => {
  it('warns when evaluatorModel equals builderModel', () => {
    const w = sameModelWarning({ key: 'cities', builderModel: 'claude-sonnet-5' }, 'claude-sonnet-5')
    expect(w).toMatch(/cities/)
    expect(w).toMatch(/claude-sonnet-5/)
  })

  it('is silent when the models differ', () => {
    expect(sameModelWarning({ key: 'cities', builderModel: 'claude-fable-5-1' }, 'claude-sonnet-5')).toBeNull()
  })
})

describe('builderModelFromCommitBody', () => {
  it('maps the three named models to their slug', () => {
    expect(builderModelFromCommitBody('fix: x\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>')).toBe(
      'claude-fable-5-1',
    )
    expect(builderModelFromCommitBody('fix: x\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')).toBe(
      'claude-opus-5',
    )
    expect(builderModelFromCommitBody('fix: x\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')).toBe(
      'claude-sonnet-5',
    )
  })

  it('keeps the raw name for an unrecognized trailer', () => {
    expect(builderModelFromCommitBody('Co-Authored-By: Claude Haiku 3 <noreply@anthropic.com>')).toBe('Claude Haiku 3')
  })

  it('is "unknown" when there is no trailer', () => {
    expect(builderModelFromCommitBody('fix(home): tidy up\n\nNo trailer here.')).toBe('unknown')
    expect(builderModelFromCommitBody('')).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// diff — including the 70-crossing markers
// ---------------------------------------------------------------------------

describe('computeDiff', () => {
  const previous = [
    { key: 'cities', median: 30 },
    { key: 'sell', median: 72 },
    { key: 'about', median: 31 },
    { key: 'invest', median: 25 },
  ]

  it('marks a class that crossed 70 upward as ↑70', () => {
    const current = [{ key: 'cities', median: 71 }]
    const [d] = computeDiff(previous, current)
    expect(d.prevMedian).toBe(30)
    expect(d.median).toBe(71)
    expect(d.change).toBe(41)
    expect(d.marker).toBe('↑70')
  })

  it('marks a class that fell back under 70 as ↓70', () => {
    const current = [{ key: 'sell', median: 68 }]
    const [d] = computeDiff(previous, current)
    expect(d.marker).toBe('↓70')
  })

  it('carries no marker for a change that does not cross the finish line', () => {
    const current = [{ key: 'about', median: 40 }]
    const [d] = computeDiff(previous, current)
    expect(d.change).toBe(9)
    expect(d.marker).toBeNull()
  })

  it('records prevMedian null for a class new to the table', () => {
    const current = [{ key: 'compare', median: 29 }]
    const [d] = computeDiff(previous, current)
    expect(d.prevMedian).toBeNull()
    expect(d.change).toBeNull()
    expect(d.marker).toBeNull()
  })

  it('respects a custom finish line', () => {
    const current = [{ key: 'invest', median: 50 }]
    const [d] = computeDiff(previous, current, { finishLine: 40 })
    expect(d.marker).toBe('↑40')
  })

  it('names classes present before but absent from the new table', () => {
    expect(droppedClasses(previous, [{ key: 'cities', median: 71 }])).toEqual(
      expect.arrayContaining(['sell', 'about', 'invest']),
    )
    expect(droppedClasses(previous, previous)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// class registry — refuses a class without a url
// ---------------------------------------------------------------------------

describe('loadClassRegistry', () => {
  it('keeps a well-formed class', () => {
    const { classes, problems } = loadClassRegistry([{ key: 'cities', route: 'app/cities/page.tsx', url: '/cities' }])
    expect(problems).toEqual([])
    expect(classes).toEqual([{ key: 'cities', route: 'app/cities/page.tsx', url: '/cities' }])
  })

  it('refuses a class with no url — the tool never guesses one', () => {
    const { classes, problems } = loadClassRegistry([{ key: 'city', route: 'app/cities/[slug]/page.tsx' }])
    expect(classes).toEqual([])
    expect(problems[0]).toMatch(/missing "url"/)
  })

  it('refuses a class with no route', () => {
    const { classes, problems } = loadClassRegistry([{ key: 'cities', url: '/cities' }])
    expect(classes).toEqual([])
    expect(problems.some((p) => p.includes('missing "route"'))).toBe(true)
  })

  it('drops a duplicate key and records it', () => {
    const raw = [
      { key: 'cities', route: 'app/cities/page.tsx', url: '/cities' },
      { key: 'cities', route: 'app/cities/page.tsx', url: '/cities-2' },
    ]
    const { classes, problems } = loadClassRegistry(raw)
    expect(classes).toHaveLength(1)
    expect(problems.some((p) => p.includes('duplicate class key'))).toBe(true)
  })

  it('rejects a non-array registry outright', () => {
    const { classes, problems } = loadClassRegistry({ not: 'an array' })
    expect(classes).toEqual([])
    expect(problems[0]).toMatch(/must be a JSON array/)
  })
})

describe('filterClasses', () => {
  const classes = [
    { key: 'cities', route: 'a', url: '/a' },
    { key: 'sell', route: 'b', url: '/b' },
  ]

  it('returns every class when no csv is given', () => {
    expect(filterClasses(classes, null).subset).toEqual(classes)
  })

  it('returns only the named subset, in registry order', () => {
    const { subset, missing } = filterClasses(classes, 'sell')
    expect(subset.map((c) => c.key)).toEqual(['sell'])
    expect(missing).toEqual([])
  })

  it('reports an unknown class key as missing', () => {
    const { missing } = filterClasses(classes, 'sell,nope')
    expect(missing).toEqual(['nope'])
  })
})

// ---------------------------------------------------------------------------
// markdown regeneration — idempotent on fixture text
// ---------------------------------------------------------------------------

const FIXTURE_DOC = [
  '### Taste table 2026-09-08 (the instrument\'s first full pass)',
  '',
  'Every public page class captured and scored. Nothing scored above 69.',
  '',
  '| class | median | scores | DQ/30 | OR/30 | IN/15 | CR/15 | HF/10 | tells | primitive named most | verdict |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  '| invest | **25** | 50 · 44 · 43 | 9 | 3 | 0 | 9 | 4 | 2 | `app/invest/page.tsx` | old verdict text |',
  '',
  'Primitives named on the most classes: `components/site/v3/V3Quiet.tsx` (6).',
  '',
  '**Done rule** — some prose that must survive untouched.',
].join('\n')

describe('renderMarkdownTable + regenerateMarkdownSection', () => {
  const rows = [
    {
      key: 'invest',
      median: 25,
      scores: [25, 19, 29],
      criteria: { designQuality: 9, originality: 3, interaction: 0, craft: 9, honestyFunction: 4 },
      tells: ['a', 'b'],
      defects: [{ primitive: 'app/invest/page.tsx' }],
      verdict: 'This is a cover memo, not a landing page.',
    },
    {
      key: 'cities',
      median: 71,
      scores: [70, 71, 73],
      criteria: { designQuality: 20, originality: 19, interaction: 12, craft: 12, honestyFunction: 8 },
      tells: [],
      defects: [{ primitive: 'components/site/v3/V3Ledger.tsx' }],
      verdict: 'Crossed the finish line.',
    },
  ]
  const instrument = { evaluatorModel: 'claude-sonnet-5', rubricVersion: 'v1-2026-09-08', scorings: 3, aggregate: 'median' }

  it('names the primitive appearing on the most defects for a class', () => {
    const defects = [{ primitive: 'a.tsx' }, { primitive: 'b.tsx' }, { primitive: 'a.tsx' }]
    expect(primitiveNamedMost(defects)).toBe('a.tsx')
    expect(primitiveNamedMost([])).toBeNull()
  })

  it('lists classes under the finish line, bottom first, in the rendered block', () => {
    const block = renderMarkdownTable(rows, { evaluatedAt: '2026-09-09', instrument })
    expect(block).toMatch(/Under 70, bottom first/)
    const underSection = block.split('Under 70, bottom first')[1]
    expect(underSection).toContain('`invest`') // 25 — still under the line
    expect(underSection).not.toContain('`cities`') // 71 — cleared the line, not listed
  })

  it('wraps the CURRENT table in markers on the first run, leaving surrounding prose untouched', () => {
    const block = renderMarkdownTable(rows, { evaluatedAt: '2026-09-09', instrument })
    const out = regenerateMarkdownSection(FIXTURE_DOC, block)
    expect(out).toContain(TASTE_TABLE_START)
    expect(out).toContain(TASTE_TABLE_END)
    expect(out).toContain('Every public page class captured and scored.') // prose before the table survives
    expect(out).toContain('Primitives named on the most classes: `components/site/v3/V3Quiet.tsx` (6).') // prose after survives
    expect(out).toContain('**Done rule** — some prose that must survive untouched.')
    expect(out).not.toContain('50 · 44 · 43') // the OLD row's scores are gone, replaced by the regenerated block
    expect(out).toContain('25 · 19 · 29') // the NEW row's real scores are present instead
  })

  it('is idempotent: regenerating twice with the same rows yields identical output', () => {
    const block = renderMarkdownTable(rows, { evaluatedAt: '2026-09-09', instrument })
    const once = regenerateMarkdownSection(FIXTURE_DOC, block)
    const twice = regenerateMarkdownSection(once, block)
    expect(twice).toBe(once)
  })

  it('a second run with DIFFERENT rows replaces only the marked block', () => {
    const block1 = renderMarkdownTable(rows, { evaluatedAt: '2026-09-09', instrument })
    const firstRun = regenerateMarkdownSection(FIXTURE_DOC, block1)
    const rows2 = [{ ...rows[0], median: 80 }, rows[1]]
    const block2 = renderMarkdownTable(rows2, { evaluatedAt: '2026-09-10', instrument })
    const secondRun = regenerateMarkdownSection(firstRun, block2)
    expect(secondRun).toContain('**80**')
    expect(secondRun).not.toContain('**25**')
    expect(secondRun).toContain('Primitives named on the most classes: `components/site/v3/V3Quiet.tsx` (6).')
  })

  it('appends the wrapped block when no table is found at all', () => {
    const out = regenerateMarkdownSection('# Just a heading\n\nSome prose, no table here.\n', 'BLOCK')
    expect(out).toContain(TASTE_TABLE_START)
    expect(out).toContain('BLOCK')
    expect(out).toContain('Some prose, no table here.')
  })
})

// ---------------------------------------------------------------------------
// CLI argv + evaluator-JSON parsing (pure, no network)
// ---------------------------------------------------------------------------

describe('parseArgv', () => {
  it('parses a plain baseUrl run', () => {
    expect(parseArgv(['http://localhost:3000'])).toMatchObject({ baseUrl: 'http://localhost:3000' })
  })

  it('parses --classes, --shots-only, --repeat, --dry-run together', () => {
    const opts = parseArgv(['http://localhost:3000', '--classes', 'cities,sell', '--shots-only', '--repeat', '--dry-run'])
    expect(opts).toMatchObject({
      baseUrl: 'http://localhost:3000',
      classesCsv: 'cities,sell',
      shotsOnly: true,
      repeat: true,
      dryRun: true,
    })
  })

  it('a bare --diff at the end takes no path', () => {
    expect(parseArgv(['--diff'])).toMatchObject({ diff: true, diffPath: null })
  })

  it('--diff <path.json> takes the path', () => {
    expect(parseArgv(['--diff', 'prior.json'])).toMatchObject({ diff: true, diffPath: 'prior.json' })
  })

  it('--diff followed by a baseUrl (not a .json) leaves diffPath null', () => {
    const opts = parseArgv(['--diff', 'http://localhost:3000'])
    expect(opts.diff).toBe(true)
    expect(opts.diffPath).toBeNull()
    expect(opts.baseUrl).toBe('http://localhost:3000')
  })

  it('--evaluate-only <dir> is captured', () => {
    expect(parseArgv(['--evaluate-only', '.taste-table/run1'])).toMatchObject({ evaluateOnlyDir: '.taste-table/run1' })
  })

  it('rejects an unknown flag', () => {
    expect(() => parseArgv(['--nope'])).toThrow(/unknown option/)
  })

  it('accepts --seed-draft without throwing unknown option', () => {
    expect(parseArgv(['--seed-draft'])).toMatchObject({ seedDraft: true, seedDraftPath: null })
  })

  it('accepts --seed-draft=path.json', () => {
    expect(parseArgv(['--seed-draft=tmp/table.json'])).toMatchObject({
      seedDraft: true,
      seedDraftPath: 'tmp/table.json',
    })
  })

  it('--cursor starts the run at grok-4.6 through the Cursor CLI', () => {
    expect(parseArgv(['--cursor', '--evaluate-only', '.taste-table/run1'])).toMatchObject({ cursor: true, claude: false })
  })
})

describe('grokLinkOrder — two links, one ruler', () => {
  it('defaults to the grok CLI, then the Cursor CLI', () => {
    expect(grokLinkOrder({ transport: 'grok' })).toEqual(['grok', 'cursor'])
  })

  it('a table scored through the Cursor CLI keeps that link first for the round', () => {
    expect(grokLinkOrder({ transport: 'grok', roundLink: 'cursor' })).toEqual(['cursor', 'grok'])
  })

  it('--cursor puts the Cursor CLI first whatever the round says', () => {
    expect(grokLinkOrder({ transport: 'cursor', roundLink: 'grok' })).toEqual(['cursor', 'grok'])
  })
})

describe('parseEvaluatorJson', () => {
  it('parses a bare JSON object', () => {
    expect(parseEvaluatorJson('{"score": 42}')).toEqual({ score: 42 })
  })

  it('tolerates a ```json fenced block', () => {
    expect(parseEvaluatorJson('```json\n{"score": 42}\n```')).toEqual({ score: 42 })
  })

  it('tolerates a plain ``` fence with no language tag', () => {
    expect(parseEvaluatorJson('```\n{"score": 42}\n```')).toEqual({ score: 42 })
  })

  it('tolerates a stray sentence around the object', () => {
    expect(parseEvaluatorJson('Sure, here you go: {"score": 42} — done.')).toEqual({ score: 42 })
  })

  it('returns null for unparsable text', () => {
    expect(parseEvaluatorJson('not json at all')).toBeNull()
    expect(parseEvaluatorJson('')).toBeNull()
  })
})
