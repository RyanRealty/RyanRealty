/**
 * The whiteboard and the plain-English rules (plain-english.ts; rules.ts R-186 to R-191).
 *
 * The rule fixtures (fixtures/R-186.json to R-191.json, run by rules.test.ts) prove each rule
 * refuses at the brief step on the real runner. These tests hold the pieces: the reading grade
 * against the Flesch-Kincaid formula, the lexicon and its glosses, dollars over percentages,
 * context first, and the whiteboard's own fields. Matt's own plain wording (2026-10-14) passes;
 * the retired buyer ad copy ("Sellers are paying to close" / "Median seller credit, Bend
 * single-family sales that reported one") fails, each for a reason a person can read.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO_ROOT } from '../../studio/qa/thresholds'
import {
  FIGURE_ID,
  INSIDER_TERMS,
  PLAIN_ENGLISH,
  WHITEBOARD_FIELDS,
  briefCopyProblems,
  checkWhiteboard,
  contentWords,
  contextFirstProblem,
  insiderHits,
  insiderProblems,
  isAd,
  parseWhiteboard,
  percentHit,
  plainEnglishThresholds,
  readingGrade,
  readingProblems,
  scriptLines,
  syllables,
  whiteboardFigureProblems,
  type BriefCopy,
  type Whiteboard,
} from './plain-english'

/** Matt's own words from 2026-10-14, as a script with no figures in it. */
const MATT_PLAIN = [
  'Are you thinking of buying in Central Oregon?',
  "You need to know what's happening in the market.",
  "Here's what we're seeing.",
  "It's been a seller's market for years.",
  "Sellers are paying some of the buyer's closing costs.",
  'This is when you want to work with someone who knows the market.',
]

/** The retired buyer ad lines (BUYER_AD.md, Matt 2026-10-14). */
const OLD_COPY = ['Sellers are paying to close', 'Median seller credit, Bend single-family sales that reported one']

const goodBoard = (over: Partial<Whiteboard> = {}): Whiteboard => ({
  author: 'ad-strategist',
  audience: 'People thinking of buying a home in Central Oregon',
  context: 'Here is what we are seeing in the Central Oregon market right now',
  insight: 'Most buyers have not heard that sellers are helping with closing costs',
  contrast: null,
  why_now: 'This is when buyers can position themselves',
  why_us: 'We have been watching the market every day',
  ask: 'Call or text us',
  script: [...MATT_PLAIN],
  figures: [],
  takes_killed: ['one', 'two', 'three', 'four'],
  ...over,
})

describe('the reading grade', () => {
  it('counts syllables the usual way: silent e and -es dropped, consonant-le kept, a figure is one', () => {
    expect([syllables('sale'), syllables('homes'), syllables('houses'), syllables('table'), syllables('Oregon'), syllables('buyer'), syllables("you're")]).toEqual([1, 1, 2, 2, 3, 2, 1])
    expect(syllables('single-family')).toBe(syllables('single') + syllables('family'))
    expect([syllables('$10,000'), syllables('3.5')]).toEqual([1, 1])
  })

  it('is the Flesch-Kincaid grade: 0.39 x words per sentence + 11.8 x syllables per word - 15.59, pooled', () => {
    const r = readingGrade(['The cat sat on the mat', 'It was a big cat'])!
    // 11 words, 2 sentences, 11 syllables.
    expect([r.words, r.sentences, r.syllables]).toEqual([11, 2, 11])
    expect(r.grade).toBeCloseTo(0.39 * (11 / 2) + 11.8 * (11 / 11) - 15.59, 10)
    expect(readingGrade([])).toBeNull()
  })

  it('reads a spoken script as lines: tags are not words, an ellipsis is a pause, a decimal is not a full stop', () => {
    expect(scriptLines('[warm] So... Bend has 3.5 months of homes. [long pause] Okay?')).toEqual(['So, Bend has 3.5 months of homes', 'Okay'])
  })

  it(`passes Matt's plain wording at or under grade ${PLAIN_ENGLISH.maxGrade}`, () => {
    const r = readingGrade(MATT_PLAIN.flatMap(scriptLines))!
    expect(r.grade).toBeLessThanOrEqual(PLAIN_ENGLISH.maxGrade)
    expect(readingProblems(MATT_PLAIN.flatMap(scriptLines), 'the script')).toEqual([])
  })

  it('fails the retired copy with the grade, the limit, and the hardest line', () => {
    const [p] = readingProblems(OLD_COPY, 'the voiceover and on-screen words together')
    expect(p).toMatch(/^reading grade 8\.2 \(Flesch-Kincaid\) for the voiceover and on-screen words together; the limit is 6/)
    expect(p).toContain('Hardest line: "Median seller credit, Bend single-family sales that reported one"')
    expect(p).toMatch(/Use shorter sentences and everyday words$/)
  })
})

describe('insider terms', () => {
  it('names each insider term in the retired copy, with why and an everyday wording', () => {
    const out = insiderProblems(OLD_COPY.map((text, i) => ({ where: `beat ${i + 1} on screen`, text })))
    const terms = out.map((p) => p.match(/^insider term "([^"]+)"/)?.[1])
    expect(terms).toEqual(['paying to close', 'seller credit', 'median', 'single-family'])
    expect(out[0]).toMatch(/Matt 2026-10-14: "Sellers are paying to close" is retired/)
    expect(out[2]).toMatch(/for example "half sold for more and half for less"/)
  })

  it('lets a term pass when the same line explains it in everyday words', () => {
    expect(insiderHits('The median, meaning half sold for more and half for less, was steady')).toEqual([])
    expect(insiderHits('A seller credit is money the seller gave the buyer at closing')).toEqual([])
    expect(insiderHits('Inventory, the homes for sale right now, is down')).toEqual([])
    // The explanation on another line does not count.
    expect(insiderHits('The median was steady').map((t) => t.term)).toEqual(['median'])
  })

  it("passes Matt's plain wording: no insider term in it", () => {
    expect(MATT_PLAIN.flatMap((l) => insiderHits(l))).toEqual([])
  })

  it('has a reason and a suggested wording for every term, and the suggestion is itself plain and counts as the gloss', () => {
    for (const t of INSIDER_TERMS) {
      expect(t.reason.trim(), t.term).not.toBe('')
      expect(insiderHits(t.example), `${t.term}: "${t.example}" uses an insider term`).toEqual([])
      expect(t.glosses.some((g) => new RegExp(g, 'i').test(t.example)), `${t.term}: "${t.example}" is not one of its glosses`).toBe(true)
      expect(/[–—]/.test(`${t.reason} ${t.example}`), `${t.term} has a dash`).toBe(false)
    }
  })

  it('catches the terms Matt named, whatever their case', () => {
    for (const line of ['MONTHS OF SUPPLY', 'Days on market: 29', 'Bend SFR sales', 'YoY change', 'a rate buy-down', 'The deal is contingent', 'now pending', 'pull comps']) {
      expect(insiderHits(line).length, line).toBeGreaterThan(0)
    }
    expect(insiderHits('months of inventory').map((t) => t.term)).toEqual(['months of supply'])
  })
})

describe('dollars over percentages', () => {
  it('finds a percentage, "percent", and an "N in 10" or "N out of N" fraction', () => {
    expect(percentHit('45% cut their price')).toEqual({ kind: 'percentage', said: '45%' })
    expect(percentHit('a few percent')?.kind).toBe('percentage')
    expect(percentHit('Seven in ten homes')).toEqual({ kind: 'fraction', said: 'Seven in ten' })
    expect(percentHit('3 out of 4 sellers')?.kind).toBe('fraction')
  })

  it('lets dollars and plain counts through', () => {
    expect(percentHit('$10,000 toward closing costs')).toBeNull()
    expect(percentHit('three and a half months of homes for sale')).toBeNull()
    expect(percentHit('Move in two weeks')).toBeNull()
  })

  it('holds a buyer ad, and any brief with a special ad category, to it; an organic market reel is not', () => {
    expect(isAd({ video_type: 'buyer_ad' })).toBe(true)
    expect(isAd({ video_type: 'market_update' })).toBe(false)
    expect(isAd({ video_type: 'market_update', special_ad_category: 'housing' })).toBe(true)
    expect(isAd({ video_type: 'listing', use: 'ads' })).toBe(true)
  })
})

describe('context first', () => {
  it('passes an opening that names the audience, by the words it shares (buying meets buy)', () => {
    expect(contextFirstProblem('Are you thinking of buying in Central Oregon?', 'voiceover line 1', goodBoard())).toBeNull()
    expect([...contentWords('Are you thinking of buying in Central Oregon?')]).toEqual(['think', 'buy', 'central', 'oregon'])
  })

  it('fails an opening that starts in the middle of a concept', () => {
    const p = contextFirstProblem('Sellers are paying to close / $10,000', 'the opening', goodBoard({ context: 'Bend homes are selling' }))
    expect(p).toMatch(/^context first: the opening shares 0 words with the whiteboard's audience and 0 with its context; it needs 2\./)
  })
})

describe('the whiteboard', () => {
  it('passes a full whiteboard by the ad-strategist, and lists its fields in one place', () => {
    expect(parseWhiteboard(goodBoard())).toEqual({ ok: true, value: goodBoard() })
    expect(WHITEBOARD_FIELDS).toEqual(['author', 'audience', 'context', 'insight', 'contrast', 'why_now', 'why_us', 'ask', 'script', 'figures', 'takes_killed'])
  })

  it('refuses a missing file, a missing or empty field, an unknown key, and a builder as author', () => {
    expect(checkWhiteboard({ path: 'out/jobs/x/whiteboard.json', missing: true }, [], true).problems[0]).toMatch(/^whiteboard: there is no whiteboard\.json beside the brief \(out\/jobs\/x\/whiteboard\.json\)/)
    const { insight: _drop, ...noInsight } = goodBoard()
    const bad = parseWhiteboard({ ...noInsight, why_us: '  ', notes: 'x', author: 'builder' })
    expect(bad.ok).toBe(false)
    const problems = bad.ok ? [] : bad.problems
    expect(problems).toEqual(
      expect.arrayContaining([
        'whiteboard: insight is missing',
        'whiteboard: why_us is empty: say it in plain words',
        expect.stringMatching(/^whiteboard: has an unknown key "notes"/),
        expect.stringMatching(/^whiteboard: author is "builder", not "ad-strategist"/),
      ]),
    )
  })

  it('wants exactly four killed takes, one line each', () => {
    const three = parseWhiteboard(goodBoard({ takes_killed: ['a', 'b', 'c'] }))
    expect(three.ok ? [] : three.problems).toEqual(['whiteboard: takes_killed has 3 reasons; the strategist writes 5 takes, kills 4, and gives one line per kill'])
    const twoLines = parseWhiteboard(goodBoard({ takes_killed: ['a', 'b\nc', 'd', 'e'] }))
    expect(twoLines.ok ? [] : twoLines.problems).toEqual(['whiteboard: takes_killed reason 2 runs onto a second line; one line per kill'])
  })

  it('runs a contrast only with the figures behind it', () => {
    const noFigures = parseWhiteboard(goodBoard({ contrast: { text: 'In 2021 homes sold at asking', figures: [] } }))
    expect(noFigures.ok ? [] : noFigures.problems).toEqual([expect.stringMatching(/^whiteboard: contrast\.figures names no figure IDs/)])
  })

  it('holds figures to brief.numbers rows: IDs only, each with a row, and a typed figure must be a named row', () => {
    const rows = [{ key: 'bend_median_credit', on_screen: '$10,000', value: 10000 }]
    const ok = goodBoard({ figures: ['bend_median_credit'], script: ['Sellers gave buyers $10,000 toward closing costs.', 'Call 541.703.3095 or text us.', 'In 2026 we saw it.'] })
    expect(whiteboardFigureProblems(ok, rows)).toEqual([])
    const bad = goodBoard({ figures: ['10000', 'bend_made_up'], contrast: { text: 'Up from 45% in 2021', figures: ['bend_other'] }, script: ['Sellers gave $12,500.'] })
    expect(whiteboardFigureProblems(bad, rows)).toEqual([
      expect.stringMatching(/^whiteboard figure "10000" is not a figure ID/),
      expect.stringMatching(/^whiteboard figure "bend_made_up" has no row in brief\.numbers/),
      expect.stringMatching(/^whiteboard figure "bend_other" has no row in brief\.numbers/),
      expect.stringMatching(/^whiteboard figure "bend_other" backs the contrast but is not listed in figures/),
      expect.stringMatching(/^whiteboard figure "\$12,500" in script line 1 is typed/),
      expect.stringMatching(/^whiteboard figure "45%" in the contrast is typed/),
    ])
  })

  it("passes Matt's plain script as a whole, and holds the script to every plain-English rule", () => {
    expect(checkWhiteboard({ path: 'w', raw: goodBoard() }, [], true)).toEqual({ whiteboard: goodBoard(), problems: [] })
    const old = checkWhiteboard({ path: 'w', raw: goodBoard({ script: [...OLD_COPY, 'Seven in ten sellers cut.'] }) }, [], true).problems
    expect(old.map((p) => p.split(/[:,]/)[0])).toEqual([
      'insider term "paying to close" in whiteboard script line 1',
      'insider term "seller credit" in whiteboard script line 2',
      'insider term "median" in whiteboard script line 2',
      'insider term "single-family" in whiteboard script line 2',
      'fraction in an ad',
      'reading grade 6.8 (Flesch-Kincaid) for the whiteboard script; the limit is 6',
      'context first',
    ])
  })
})

describe('the brief copy', () => {
  const copy = (over: Partial<BriefCopy> = {}): BriefCopy => ({
    voiceover: `[warm] ${MATT_PLAIN.join(' ')}`,
    screen: [{ where: 'beat "hook" on screen', texts: ['Buying in Central Oregon?'] }, { where: 'beat "plan" on screen', texts: ['Sellers are helping with closing costs'] }],
    hook: 'Buying in Central Oregon?',
    caption: 'Thinking of buying in Central Oregon? Here is what we are seeing.',
    ...over,
  })

  it("passes Matt's plain wording on screen and in the voiceover", () => {
    expect(briefCopyProblems(copy(), goodBoard(), true)).toEqual([])
  })

  it('fails the retired buyer ad copy with plain reasons: the terms, the grade, and no context first', () => {
    const old = briefCopyProblems(
      copy({ voiceover: null, screen: OLD_COPY.map((t, i) => ({ where: `beat ${i + 1} on screen`, texts: [t] })), hook: OLD_COPY[0], caption: null }),
      goodBoard(),
      true,
    )
    expect(old.filter((p) => p.startsWith('insider term')).length).toBe(5)
    expect(old.some((p) => /^reading grade 8\.2 \(Flesch-Kincaid\)/.test(p))).toBe(true)
    expect(old.some((p) => /^context first: the opening \(voiceover line 1 and beat 1 on screen\) shares 0 words/.test(p))).toBe(true)
  })

  it('names a percentage where it is drawn, in an ad only', () => {
    const pct = copy({ screen: [{ where: 'beat "hook" on screen', texts: ['Buying in Central Oregon?', '45% cut their price'] }] })
    expect(briefCopyProblems(pct, goodBoard(), true)).toEqual([expect.stringMatching(/^percentage in an ad, beat "hook" on screen: "45%" in "45% cut their price"/)])
    expect(briefCopyProblems(pct, goodBoard(), false)).toEqual([])
  })
})

describe('the whiteboard schema', () => {
  const schema = JSON.parse(readFileSync(join(REPO_ROOT, '.claude/skills/ryan-studio/templates/whiteboard.schema.json'), 'utf8'))
  const base = JSON.parse(readFileSync(join(REPO_ROOT, 'lib/content/process/fixtures/base.whiteboard.json'), 'utf8'))

  it('sits beside the brief schema and names exactly the fields the code reads, closed to others', () => {
    expect(schema.required).toEqual([...WHITEBOARD_FIELDS])
    expect(Object.keys(schema.properties)).toEqual([...WHITEBOARD_FIELDS])
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.author.const).toBe('ad-strategist')
  })

  it('states the killed-take count and length the code holds, so the two cannot drift', () => {
    const t = schema.properties.takes_killed
    expect([t.minItems, t.maxItems, t.items.maxLength]).toEqual([PLAIN_ENGLISH.takesKilled, PLAIN_ENGLISH.takesKilled, PLAIN_ENGLISH.maxReasonChars])
    expect(schema.properties.figures.items.pattern).toBe(FIGURE_ID.source)
    expect(schema.properties.contrast.oneOf[1].properties.figures.items.pattern).toBe(FIGURE_ID.source)
  })

  it("passes the base film's whiteboard, the one every rule fixture runs with", () => {
    expect(parseWhiteboard(base).ok).toBe(true)
    expect(Object.keys(base)).toEqual([...WHITEBOARD_FIELDS])
  })
})

describe('the numbers the ratchet holds', () => {
  it('exposes every limit and list under the names rules.ts points at', () => {
    const t = plainEnglishThresholds()
    expect(Object.keys(t).sort()).toEqual(
      ['ad_types', 'context_min_shared_words', 'every_housing_ad', 'glosses', 'insider_terms', 'max_grade', 'max_reason_chars', 'require_whiteboard', 'takes_killed', 'whiteboard_fields'].sort(),
    )
    expect(t.max_grade).toBe(PLAIN_ENGLISH.maxGrade)
    expect(t.insider_terms).toEqual(INSIDER_TERMS.map((x) => x.term))
    expect((t.glosses as string[]).every((g) => / => /.test(g))).toBe(true)
  })
})
