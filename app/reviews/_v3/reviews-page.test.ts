import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync('app/reviews/page.tsx', 'utf8')

describe('reviews page composition', () => {
  it('opens on V3Proof with archive, not a 25-card list as the design', () => {
    expect(PAGE).toContain('<V3Proof')
    expect(PAGE).toMatch(/archive/)
    expect(PAGE).not.toContain('V3Ledger')
    expect(PAGE).toContain('<V3Doors')
  })

  it('gives the proof headline headingLevel 1 and keeps V3Doors as the close', () => {
    expect(PAGE).toContain('headline={heading}')
    expect(PAGE).toContain('headingLevel={1}')
    expect(PAGE).toContain('id="next"')
  })

  /**
   * SITE-48 folded reach into the proof band. SITE-79 keeps Call + Book as the
   * slim ask under the lead quote so 375 still has a path to a broker; Text /
   * Email / fuller doors close the page. Never a Quiet #reach above the proof.
   */
  it('folds the reach into the proof band, after the score, never as a section above it', () => {
    expect(PAGE).not.toContain('id="reach"')
    expect(PAGE).not.toContain('ariaLabel="Reach a broker"')
    const actionsIdx = PAGE.indexOf('reachActions')
    const proofIdx = PAGE.indexOf('<V3Proof')
    const doorsIdx = PAGE.indexOf('id="next"')
    expect(actionsIdx).toBeGreaterThan(-1)
    expect(PAGE).toContain('actions={reachActions}')
    expect(doorsIdx).toBeGreaterThan(proofIdx)
    expect(PAGE).toContain('tel:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain("href: '/book'")
    expect(PAGE).toContain("href: '/team'")
  })

  it('imports the shadcn-avatar composition on the route _v3 (SITE-109, SITE-167)', () => {
    const avatars = readFileSync('app/reviews/_v3/ReviewsAvatars.ts', 'utf8')
    const group = readFileSync('app/reviews/_v3/ReviewsAvatarGroup.client.tsx', 'utf8')
    expect(avatars).toMatch(/import\s*\{[\s\S]*AvatarImage[\s\S]*\}\s*from\s*'@\/components\/ui\/avatar'/)
    expect(avatars).toContain('AvatarGroup')
    expect(avatars).toContain('AvatarImage')
    expect(group).toContain('AvatarGroup')
    expect(group).toContain('AvatarFallback')
    expect(group).toContain('AvatarImage')
    expect(group).toContain('brokersForReviews')
    expect(group).not.toContain('/images/catalog/shadcn-avatar/')
    expect(group).toContain('DropdownMenuGroup')
    expect(group).toContain('Meet ')
    expect(group).not.toContain('Read this review')
    expect(group).not.toMatch(/>\s*Sign Out\s*</)
  })

  it('leads with the score face rather than a bare figure row', () => {
    expect(PAGE).toContain('face')
    expect(PAGE).toContain("{ value: average.toFixed(1), label: 'average of 5' }")
    expect(PAGE).toContain("{ value: String(count), label: 'Google reviews' }")
  })

  it('names brokers with images in reviews JSON-LD', () => {
    const jsonld = readFileSync('app/reviews/_v3/reviews-jsonld.ts', 'utf8')
    expect(jsonld).toContain('REVIEW_BROKERS')
    expect(jsonld).toContain('primaryImageOfPage')
    expect(jsonld).toContain('employee')
    expect(jsonld).not.toMatch(/['"]aggregateRating['"]\s*:/)
  })
})
