import { describe, it, expect } from 'vitest'
import {
  findPunctuationViolations,
  isDebugOutput,
  isEmbeddedCode,
  isProseSentence,
  stripInterpolations,
} from '../check-brand-voice.mjs'

/**
 * Locks the punctuation arm of the brand-voice gate.
 *
 * The rule, per Matt (2026-08-02): "The em dash rule only applies to text users
 * are reading on a page that might make it seem like it was written by AI."
 *
 * So the target is an em dash inside an authored SENTENCE. It is NOT a target
 * in a page title, a short label, a field separator, or an accessibility
 * attribute — and flagging it there is worse than useless, because the "fix"
 * degrades real copy. Both directions are tested, because over-flagging is the
 * failure mode that actually happened.
 */

const at = (value, relPath = 'app/example/page.tsx', lineText = '  <p>') =>
  findPunctuationViolations(value, 1, value.slice(0, 80), relPath, lineText)

describe('flags an em dash that reads as AI-written prose', () => {
  it('flags a dash joining two clauses in body copy', () => {
    expect(
      at('We price from live market data — not from a guess about what the neighbors got.'),
    ).toHaveLength(1)
  })

  it('flags the dramatic expansion, even with few words in front of it', () => {
    // The tell is the clause AFTER the dash, not a balanced sentence.
    expect(at('Central Oregon — where the high desert meets the mountains and the trails')).toHaveLength(1)
  })

  it('flags an en dash used the same way', () => {
    expect(
      at('Buying in Bend takes preparation – you want your financing sorted before you tour.'),
    ).toHaveLength(1)
  })

  it('reports the character and the remedy so the failure is actionable', () => {
    const [v] = at('Selling your home in Bend takes preparation — pricing, photos, and timing all matter.')
    expect(v.word).toMatch(/em-dash/)
    expect(v.word).toMatch(/Replace with a period or comma/)
  })
})

describe('does NOT flag text no reader clocks as AI writing', () => {
  it('exempts a short status label', () => {
    expect(at('No MLS match — manual CMA needed')).toHaveLength(0)
  })

  it('exempts a name or place followed by a value, not a clause', () => {
    expect(at('Matt Ryan — Ryan Realty principal broker Bend Oregon')).toHaveLength(0)
    expect(at('Awbrey Butte — 12 active listings and a median of 1.2M')).toHaveLength(0)
  })

  it('exempts the bare data placeholder ("unavailable" in a stats table)', () => {
    expect(at('—')).toHaveLength(0)
    expect(at(' — ')).toHaveLength(0)
  })

  it('exempts a dash living inside a ${...} fallback expression', () => {
    expect(at("Beds: ${beds ?? '—'}")).toHaveLength(0)
  })

  it('exempts numeric and interpolated ranges', () => {
    expect(at('$300K – $500K')).toHaveLength(0)
    expect(at('${report.period_start} – ${report.period_end}')).toHaveLength(0)
  })

  it('exempts accessibility attributes, which are announced not read as prose', () => {
    const sentence = 'Open house on Saturday — see the full schedule of times below'
    expect(at(sentence, 'app/x/page.tsx', '  aria-label=')).toHaveLength(0)
    expect(at(sentence, 'app/x/page.tsx', '  alt=')).toHaveLength(0)
    // Same sentence as body copy is still a violation.
    expect(at(sentence, 'app/x/page.tsx', '  <p>')).toHaveLength(1)
  })

  it('exempts debug output (§2: debugging logs are not governed)', () => {
    expect(at('[search] listings fetch degraded — city was not resolvable from the slug')).toHaveLength(0)
    expect(isDebugOutput('[sync] done — 12 rows')).toBe(true)
    expect(isDebugOutput('Sell your home — fast')).toBe(false)
  })

  it('exempts embedded CSS and inline script bodies', () => {
    expect(isEmbeddedCode('.hero{color:var(--navy);padding:10px;}')).toBe(true)
    expect(isEmbeddedCode('window.dataLayer = window.dataLayer || [];')).toBe(true)
    expect(isEmbeddedCode('Open Houses in Central Oregon — This Weekend')).toBe(false)
  })

  it('exempts client reviews (§2: never touches reviews or external quotes)', () => {
    const quote = 'Selling a house is an emotional roller coaster — he managed the downs for us.'
    expect(at(quote, 'app/lp/seller-home-value/data.ts')).toHaveLength(0)
    // The same sentence in our OWN marketing copy is still a violation.
    expect(at(quote, 'app/sell/page.tsx')).toHaveLength(1)
  })
})

describe('SEO metadata carve-out (Matt, 2026-08-02)', () => {
  const atLine = (lineText, value, prevLineText = '') =>
    findPunctuationViolations(value, 1, value.slice(0, 60), 'app/x/page.tsx', lineText, prevLineText)

  it('allows an em dash in a page title and the layout template', () => {
    expect(atLine("title: 'FAQ — Real Estate in Bend, Oregon',", 'FAQ — Real Estate in Bend, Oregon')).toHaveLength(0)
    expect(
      atLine('  template: "%s | Ryan Realty — Central Oregon",', '%s | Ryan Realty — Central Oregon'),
    ).toHaveLength(0)
  })

  it('allows an em dash in a meta description even when it is a full sentence', () => {
    const desc = 'Search homes across Central Oregon — pricing, photos, and live market data on every listing.'
    // Real shape in this repo: the key on one line, the string on the next.
    expect(atLine("    '" + desc + "',", desc, '  description:')).toHaveLength(0)
    // Identical sentence as body copy is still a violation.
    expect(atLine('  <p>', desc)).toHaveLength(1)
  })
})

describe('isProseSentence', () => {
  it('needs a lowercase clause of real length after the dash', () => {
    expect(isProseSentence('Central Oregon — where the high desert meets the mountains', '—')).toBe(true)
    expect(isProseSentence('Matt Ryan — Ryan Realty principal broker Bend Oregon', '—')).toBe(false)
    expect(isProseSentence('No MLS match — manual CMA needed', '—')).toBe(false)
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
