import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { boundarySanityFailures } from '../check-boundary-sanity.mjs'

const snap = (rows) => ({ thresholdAcres: 800, boundaries: rows })
const EVIDENCE = 'The county community line around the resort, not a listing hull; checked on 2026-09-25.'

describe('ci:boundary-sanity (G47): verified vs awaiting correction', () => {
  it('passes the committed snapshot and baseline', () => {
    const s = JSON.parse(readFileSync('data/boundary-sanity.json', 'utf8'))
    const b = JSON.parse(readFileSync('data/boundary-sanity-baseline.json', 'utf8'))
    expect(boundarySanityFailures(s, b).failures).toEqual([])
  })

  it('fails an oversized boundary that is neither verified nor awaiting correction', () => {
    const { failures } = boundarySanityFailures(snap([{ slug: 'new-resort', acres: 5000 }]), { allowed: [], verified: {} })
    expect(failures.join('\n')).toMatch(/new-resort \(5000 acres\) exceeds 800 acres/)
  })

  it('accepts a verified boundary at its recorded acres, and fails it once the polygon moves more than 1%', () => {
    const baseline = { allowed: [], verified: { sunriver: { acres: 3744, source: 'Deschutes County GIS Unincorporated Communities', evidence: EVIDENCE } } }
    expect(boundarySanityFailures(snap([{ slug: 'sunriver', acres: 3760 }]), baseline).failures).toEqual([])
    expect(boundarySanityFailures(snap([{ slug: 'sunriver', acres: 10113 }]), baseline).failures.join('\n')).toMatch(
      /sunriver was verified at 3744 acres and now measures 10113/,
    )
  })

  it('demands evidence for an outline awaiting correction, and refuses one listed both ways', () => {
    const noEvidence = boundarySanityFailures(snap([{ slug: 'x', acres: 900 }]), { allowed: ['x'], verified: {} })
    expect(noEvidence.failures.join('\n')).toMatch(/x awaits correction with no evidence/)
    const both = boundarySanityFailures(snap([{ slug: 'x', acres: 900 }]), {
      allowed: ['x'],
      evidence: { x: EVIDENCE },
      verified: { x: { acres: 900, source: 'City of Bend GIS', evidence: EVIDENCE } },
    })
    expect(both.failures.join('\n')).toMatch(/x is both verified and awaiting correction/)
  })

  it('fails a verified entry whose row left the snapshot', () => {
    const { failures } = boundarySanityFailures(snap([]), {
      allowed: [],
      verified: { gone: { acres: 1000, source: 'City of Bend GIS', evidence: EVIDENCE } },
    })
    expect(failures.join('\n')).toMatch(/gone is verified but has no row/)
  })
})
