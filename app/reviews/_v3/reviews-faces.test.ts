import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { brokerKeyForReview, brokersForReviews, REVIEW_BROKERS } from './reviews-faces'

describe('reviews broker faces (SITE-167)', () => {
  it('uses canonical PNG headshots, never catalog or JPG stand-ins', () => {
    expect(REVIEW_BROKERS).toHaveLength(3)
    expect(REVIEW_BROKERS.map((b) => b.key)).toEqual(['matt', 'rebecca', 'paul'])
    for (const b of REVIEW_BROKERS) {
      expect(b.src).toMatch(/^\/images\/brokers\/[a-z-]+\.png$/)
      expect(b.src).not.toMatch(/\.jpg$/)
      expect(b.href).toMatch(/^\/team\//)
      expect(b.initials.length).toBeGreaterThan(0)
    }
    expect(REVIEW_BROKERS[0]?.src).toBe('/images/brokers/ryan-matt.png')
  })

  it('names the broker a review is about, else the principal', () => {
    expect(brokerKeyForReview('Matt was always available')).toBe('matt')
    expect(brokerKeyForReview('Rebecca made the process easy')).toBe('rebecca')
    expect(brokerKeyForReview('Paul found us the right house')).toBe('paul')
    expect(brokerKeyForReview('Great experience with the team')).toBe('matt')
  })

  it('leads the row with the named broker', () => {
    expect(brokersForReviews('Rebecca was wonderful')[0]?.key).toBe('rebecca')
    expect(brokersForReviews()[0]?.key).toBe('matt')
  })
})

describe('ReviewsAvatarGroup honest portraits', () => {
  const group = readFileSync('app/reviews/_v3/ReviewsAvatarGroup.client.tsx', 'utf8')
  const avatars = readFileSync('app/reviews/_v3/ReviewsAvatars.ts', 'utf8')

  it('installs AvatarImage of brokers, not reviewer initials or catalog faces', () => {
    expect(avatars).toContain('AvatarImage')
    expect(group).toContain('AvatarImage')
    expect(group).toContain('AvatarGroup')
    expect(group).toContain('AvatarFallback')
    expect(group).toContain('AvatarGroupCount')
    expect(group).toContain('brokersForReviews')
    expect(group).toContain('No reviewer photos from Google')
    expect(group).toContain('Meet ')
    expect(group).toContain('View on Google')
    expect(group).toContain('All reviews')
    expect(group).toContain('v3-proof__avatar-btn')
    expect(group).not.toContain('/images/catalog/shadcn-avatar/')
    expect(group).not.toContain('https://github.com/shadcn.png')
    expect(group).not.toContain('CATALOG_PORTRAITS')
    expect(group).not.toMatch(/>\s*Sign Out\s*</)
    expect(group).not.toContain('Read this review')
  })
})
