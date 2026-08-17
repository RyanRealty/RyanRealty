import { describe, expect, it } from 'vitest'
import {
  parsePlaceMosPairs,
  publishBlogMosKind,
  rewriteBlogMosVerdicts,
} from './publish-blog-mos-verdicts'

const FOUNDING = `
<p>The regional number hides the spread. Redmond sits at 3.9 months of supply, still on the seller's side of the line. Bend reads 4.2, balanced. Sisters and Prineville hold the middle at 5.9 and 5.4. Sunriver at 12.0, Madras at 5.4, and La Pine at 11.4 are firmly in buyer's territory. Where you stand in a negotiation depends on which of these markets you are standing in, not on the regional headline.</p>
`

describe('publishBlogMosKind', () => {
  it('uses the canonical ≤4 / under 6 / ≥6 buckets', () => {
    expect(publishBlogMosKind(3.9).kind).toBe('sellers')
    expect(publishBlogMosKind(4).kind).toBe('sellers')
    expect(publishBlogMosKind(4.2).kind).toBe('balanced')
    expect(publishBlogMosKind(5.4).kind).toBe('balanced')
    expect(publishBlogMosKind(5.9).kind).toBe('balanced')
    expect(publishBlogMosKind(6).kind).toBe('buyers')
    expect(publishBlogMosKind(12).kind).toBe('buyers')
  })
})

describe('parsePlaceMosPairs', () => {
  it('reads Place at N.N pairs', () => {
    expect(parsePlaceMosPairs('Sunriver at 12.0, Madras at 5.4, and La Pine at 11.4')).toEqual([
      { place: 'Sunriver', mos: 12, display: '12.0' },
      { place: 'Madras', mos: 5.4, display: '5.4' },
      { place: 'La Pine', mos: 11.4, display: '11.4' },
    ])
  })
})

describe('rewriteBlogMosVerdicts', () => {
  it('moves a balanced MOS out of a buyer territory list', () => {
    const out = rewriteBlogMosVerdicts(FOUNDING)
    expect(out).toContain("Sunriver at 12.0 and La Pine at 11.4 are firmly in buyer's territory")
    expect(out).toContain('Madras at 5.4 is a balanced market')
    expect(out).not.toMatch(/Sunriver at 12\.0, Madras at 5\.4, and La Pine at 11\.4 are firmly in buyer's territory/)
    expect(out).toContain('Sisters and Prineville hold the middle at 5.9 and 5.4')
    expect(out).toContain('Redmond sits at 3.9 months of supply, still on the seller\'s side of the line')
  })

  it('rewrites an inline months + verdict mismatch', () => {
    const out = rewriteBlogMosVerdicts('<li><strong>Madras: 5.4 months</strong>, a buyer\'s market</li>')
    expect(out).toContain("5.4 months</strong>, a balanced market")
    expect(out).not.toContain("a buyer's market")
  })

  it('leaves a correctly classified buyer list alone', () => {
    const src = 'Sunriver at 12.0 and La Pine at 11.4 are firmly in buyer\'s territory.'
    expect(rewriteBlogMosVerdicts(src)).toBe(src)
  })
})
