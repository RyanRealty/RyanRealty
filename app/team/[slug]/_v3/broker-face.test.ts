import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync('app/team/[slug]/page.tsx', 'utf8')
const FOLD = PAGE.slice(PAGE.indexOf('return ('), PAGE.indexOf('<V3Quiet'))

describe('broker fold', () => {
  it('opens on the About face, not a Quiet graf', () => {
    expect(PAGE).toContain("from '@/app/about/_v3/AboutFaces'")
    expect(PAGE).toContain('aboutFaceFromBroker')
    expect(FOLD).toContain('<AboutFaces')
    expect(FOLD).not.toContain('Value my home')
    expect(FOLD).not.toContain('factualFallbackBio')
  })
})
