import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

import {
  collectScannedFiles,
  findSelfPraiseViolations,
  functionScopeRanges,
  PUBLIC_COPY_FUNCTIONS,
} from '../check-brand-voice.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(import.meta.url)
const VOCAB = require('../brand-voice-vocabulary.cjs')
const CANON = readFileSync(join(ROOT, 'marketing_brain_skills/brand-voice/VOICE.md'), 'utf8')

/**
 * Locks WHAT the brand-voice gate reads, and that the canon reached the machine
 * list. Both arms exist because both have already failed silently.
 *
 * SCOPE. A reviewer reported the gate blind to "copy that lives in .ts data
 * modules" and cited app/cities/[slug]/_v3/city-market-charts-data.ts. That
 * file was in scope the whole time — FILE_EXTS has always held '.ts'. The
 * genuinely unscanned public copy was one directory over, in the data/ and
 * lib/*-content.ts registries the city, community, resort, event, trail, venue,
 * school and golf pages render their sentences from. Nothing about the gate
 * announces which of those it reads, so the answer gets guessed at. This pins
 * it.
 *
 * PROJECTION. VOICE.md names the banned virtues in a sentence; the machine list
 * has to carry them. It stopped twice: once on 2026-08-06 (four terms
 * unprojected, "Honest answers..." shipped on /faq against a green gate), then
 * again at D11 (0ad6a0c2) when the list and its hand-maintained guard were
 * narrowed in the same commit.
 */

const scanned = new Set(collectScannedFiles().map((f) => relative(ROOT, f).split('\\').join('/')))

describe('scan scope covers public copy that lives in .ts modules', () => {
  it('reads .ts data modules under app/, not only .tsx', () => {
    expect(scanned.has('app/cities/[slug]/_v3/city-market-charts-data.ts')).toBe(true)
  })

  it.each([
    'data/co-events.ts',
    'data/co-parks.ts',
    'data/co-schools.ts',
    'data/co-trails.ts',
    'data/co-venues.ts',
    'data/golf-landing.ts',
    'data/golf/faqs.ts',
    'data/golf/insider-notes.ts',
  ])('reads the %s page registry', (rel) => {
    expect(scanned.has(rel)).toBe(true)
  })

  it.each([
    'lib/city-content.ts',
    'lib/community-content.ts',
    'lib/community-seo-content.ts',
    'lib/lead-landing-content.ts',
    'lib/resort-community-content.ts',
  ])('reads the %s registry', (rel) => {
    expect(scanned.has(rel)).toBe(true)
  })

  it.each([
    'lib/cma-delivery.ts',
    'lib/bpo/send.ts',
    'lib/cma/inbound-packet.ts',
  ])('reads the client-facing composer file %s', (rel) => {
    expect(scanned.has(rel)).toBe(true)
  })

  it('does NOT sweep lib/ wholesale', () => {
    // Re-measured 2026-08-19: lib/ as a whole reports 170 violations across 69
    // files, overwhelmingly agent prompts, pipeline diagnostics and developer
    // prose. Only the named -content.ts registries and the named composer files
    // are in.
    //
    // The composer half is derived from PUBLIC_COPY_FUNCTIONS, not retyped, so
    // registering a new composer cannot silently widen what this test calls
    // acceptable — and cannot fail it for a reason the reader has to guess.
    const composerFiles = new Set(PUBLIC_COPY_FUNCTIONS.map((e) => e.file))
    const libFiles = [...scanned].filter((f) => f.startsWith('lib/'))
    expect(libFiles.length).toBeGreaterThan(0)
    const unexpected = libFiles.filter(
      (f) => !f.endsWith('-content.ts') && !composerFiles.has(f)
    )
    expect(unexpected).toEqual([])
  })

  it('does not read colocated tests as copy', () => {
    expect([...scanned].some((f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f))).toBe(false)
  })
})

describe('function-scoped public copy', () => {
  /**
   * composeCmaEmail builds the homeowner's CMA delivery email in two parallel
   * bodies. The html branch was rewritten to the canon; the text branch kept
   * "The full report is attached — it walks through..." and shipped. The file
   * cannot be covered wholesale (it also holds an internal errors[] row with an
   * em dash, bound for the admin queue, and baselines only shrink), so scope is
   * the function body. These pin that the line is drawn where it is claimed.
   */
  it('every named composer resolves in its file', () => {
    for (const { file, fn } of PUBLIC_COPY_FUNCTIONS) {
      const src = readFileSync(join(ROOT, file), 'utf8')
      expect(functionScopeRanges(src, [fn]), `${file} → ${fn}`).not.toBeNull()
    }
  })

  it('fails resolution when the composer is renamed', () => {
    // A rename must break the gate loudly, not quietly drop the copy.
    const src = readFileSync(join(ROOT, 'lib/cma-delivery.ts'), 'utf8')
    expect(functionScopeRanges(src, ['composeCmaEmailRenamed'])).toBeNull()
  })

  it('covers the sent body and excludes the internal queue log', () => {
    const src = readFileSync(join(ROOT, 'lib/cma-delivery.ts'), 'utf8')
    const ranges = functionScopeRanges(src, ['composeCmaEmail'])
    const covers = (needle) => {
      const at = src.indexOf(needle)
      expect(at, `not found: ${needle}`).toBeGreaterThan(-1)
      return ranges.some((r) => at >= r.start && at < r.end)
    }
    expect(covers('The full report is attached')).toBe(true)
    expect(covers('no assigned broker email available')).toBe(false)
  })

  it('keeps the two bodies of the sent email on the same sentences', () => {
    const src = readFileSync(join(ROOT, 'lib/cma-delivery.ts'), 'utf8')
    for (const sentence of [
      'The full report is attached. It walks through the comparable sales we used, what we adjusted for, and where the number could move.',
      'If you want to talk through it, or have us walk through in person, just reply to this email or call. No pressure either way.',
    ]) {
      expect(src.split(sentence).length - 1, sentence).toBe(2)
    }
  })
})

describe('the canon reaches the machine list', () => {
  const virtues = (CANON.match(/Do not call ourselves\s+([^.]+?)\s*,?\s*or any other virtue/i)?.[1] ?? '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]+$/.test(w))

  it('finds the canon sentence the gate anchors on', () => {
    expect(virtues.length).toBeGreaterThan(0)
  })

  it.each(virtues)('projects the banned virtue "%s"', (virtue) => {
    expect(VOCAB.SELF_PRAISE.some((p) => p.includes(virtue))).toBe(true)
  })

  it('keeps the About-mission exemption verbatim with the canon', () => {
    expect(CANON).toContain(VOCAB.ABOUT_MISSION_SENTENCE)
  })

  it('leaves the terms D11 un-banned alone', () => {
    // VOICE.md: "Other true facts may stay (boutique, premier, full-service if
    // true)." Re-adding them would enforce a rule the canon retired.
    for (const allowed of ['boutique', 'premier', 'full-service']) {
      expect(VOCAB.SELF_PRAISE.some((p) => p.includes(allowed))).toBe(false)
    }
  })
})

describe('never name the virtues', () => {
  const at = (value, relPath = 'components/Example.tsx') =>
    findSelfPraiseViolations(value, 1, value.slice(0, 80), relPath)

  it('flags a virtue claimed for us', () => {
    expect(at('Honest answers about the Bend market.')).toHaveLength(1)
    expect(at('A dedicated team behind every listing.')).toHaveLength(1)
  })

  it('allows the About mission sentence on About', () => {
    expect(at(VOCAB.ABOUT_MISSION_SENTENCE, 'app/about/_v3/about-constants.ts')).toHaveLength(0)
  })

  it('flags the same sentence anywhere else', () => {
    // VOICE.md: "Nowhere else uses authentic / exceptional as a claim about us."
    expect(at(VOCAB.ABOUT_MISSION_SENTENCE, 'app/sell/page.tsx').length).toBeGreaterThan(0)
  })

  it('does not flag the adjective outside a claim about us', () => {
    // The canon bans claiming the virtue, not the word. A described house and a
    // described process are not brags.
    expect(at('The seller wanted an honest read on the ask.')).toHaveLength(0)
    expect(at('Simple to tour, hard to leave.')).toHaveLength(0)
  })

  it('does not flag the opposite of the sin', () => {
    // Substring matching reported "a dishonest broker" as claiming honesty.
    expect(at('The prior listing was handled by a dishonest broker.')).toHaveLength(0)
  })
})
