import { describe, it, expect } from 'vitest'
import {
  findPunctuationViolations,
  isDebugOutput,
  isEmbeddedCode,
  stripInterpolations,
} from '../check-brand-voice.mjs'

/**
 * Locks the punctuation arm of the brand-voice gate (wired 2026-08-02).
 *
 * Before it existed, VOCAB.PUNCTUATION was exported and read by nothing, so
 * CLAUDE.md §6 listed the rule as GATED while an em dash sat in the layout
 * title template and shipped on all 20 page titles.
 *
 * Two directions matter equally and both are tested here:
 *   CATCHES  — a dash in authored prose must fail, or the hole reopens.
 *   EXEMPTS  — the §2 carve-outs must keep passing, or the gate starts
 *              flagging legitimate output and the "fix" degrades the product
 *              ("$300K – $500K" does not improve as "$300K. $500K").
 */

const at = (value, relPath = 'app/example/page.tsx') =>
  findPunctuationViolations(value, 1, value.slice(0, 80), relPath)

describe('brand-voice punctuation gate — catches real prose violations', () => {
  it('flags the em dash that shipped in the layout title template', () => {
    expect(at('%s | Ryan Realty — Central Oregon Real Estate')).toHaveLength(1)
  })

  it('flags an em dash used as dramatic prose punctuation', () => {
    expect(at('Compare up to 4 homes side by side — price, size, and features.')).toHaveLength(1)
  })

  it('flags an en dash between two words', () => {
    expect(at('Matt Ryan – Ryan Realty')).toHaveLength(1)
  })

  it('reports the character and the remedy so the failure is actionable', () => {
    const [v] = at('FAQ — Real Estate in Bend, Oregon')
    expect(v.word).toMatch(/em-dash/)
    expect(v.word).toMatch(/Replace with a period or comma/)
  })
})

describe('brand-voice punctuation gate — honors the §2 carve-outs', () => {
  it('exempts the bare data placeholder (§2: "unavailable" in a stats table)', () => {
    expect(at('—')).toHaveLength(0)
    expect(at(' — ')).toHaveLength(0)
  })

  it('exempts a dash living inside a ${...} fallback expression', () => {
    // The authored text is "Beds: "; the dash is a code-level fallback value.
    expect(at("Beds: ${beds ?? '—'}")).toHaveLength(0)
  })

  it('exempts numeric and interpolated ranges', () => {
    expect(at('$300K – $500K')).toHaveLength(0)
    expect(at('${report.period_start} – ${report.period_end}')).toHaveLength(0)
    expect(at('${yearRange.min} – ${yearRange.max}')).toHaveLength(0)
  })

  it('exempts debug output (§2: debugging logs are not governed)', () => {
    expect(at('[search] listings fetch degraded — city=bend')).toHaveLength(0)
    expect(isDebugOutput('[sync] done — 12 rows')).toBe(true)
    expect(isDebugOutput('Sell your home — fast')).toBe(false)
  })

  it('exempts embedded CSS and inline script bodies', () => {
    expect(isEmbeddedCode('.hero{color:var(--navy);padding:10px;}')).toBe(true)
    expect(isEmbeddedCode('@media (max-width: 600px) { .a { display:none; } }')).toBe(true)
    expect(isEmbeddedCode('window.dataLayer = window.dataLayer || [];')).toBe(true)
    expect(isEmbeddedCode('Open Houses in Central Oregon — This Weekend')).toBe(false)
  })

  it('exempts client reviews (§2: never touches reviews or external quotes)', () => {
    const quote = 'Selling a house is an emotional roller coaster — Matt managed the downs.'
    expect(at(quote, 'app/lp/seller-home-value/data.ts')).toHaveLength(0)
    // The same sentence in our OWN marketing copy is still a violation.
    expect(at(quote, 'app/sell/page.tsx')).toHaveLength(1)
  })
})

describe('stripInterpolations', () => {
  it('removes ${...} blocks so in-expression dashes are not read as prose', () => {
    expect(stripInterpolations("a ${x ?? '—'} b")).not.toContain('—')
  })

  it('leaves authored text between interpolations intact', () => {
    expect(stripInterpolations('${a} — ${b}')).toContain('—')
  })
})
