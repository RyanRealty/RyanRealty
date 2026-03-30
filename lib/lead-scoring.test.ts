import { describe, it, expect } from 'vitest'
import { scoreToTier, applyDecay, activityTypeToPoints, POINTS, LEAD_TIERS } from './lead-scoring'

describe('lead-scoring', () => {
  describe('scoreToTier', () => {
    it('returns cold for score < 21', () => {
      expect(scoreToTier(0)).toBe('cold')
      expect(scoreToTier(10)).toBe('cold')
      expect(scoreToTier(20)).toBe('cold')
    })

    it('returns warm for score 21-50', () => {
      expect(scoreToTier(21)).toBe('warm')
      expect(scoreToTier(35)).toBe('warm')
      expect(scoreToTier(50)).toBe('warm')
    })

    it('returns hot for score 51-100', () => {
      expect(scoreToTier(51)).toBe('hot')
      expect(scoreToTier(75)).toBe('hot')
      expect(scoreToTier(100)).toBe('hot')
    })

    it('returns very_hot for score >= 101', () => {
      expect(scoreToTier(101)).toBe('very_hot')
      expect(scoreToTier(200)).toBe('very_hot')
      expect(scoreToTier(500)).toBe('very_hot')
    })
  })

  describe('applyDecay', () => {
    it('returns original score when weeks is 0', () => {
      expect(applyDecay(100, 0)).toBe(100)
    })

    it('returns original score when weeks is negative', () => {
      expect(applyDecay(100, -1)).toBe(100)
    })

    it('applies 20% decay per week', () => {
      // After 1 week: 100 * 0.8 = 80
      expect(applyDecay(100, 1)).toBe(80)
    })

    it('compounds decay over multiple weeks', () => {
      // After 2 weeks: 100 * 0.8 * 0.8 = 64
      expect(applyDecay(100, 2)).toBe(64)
      // After 3 weeks: 100 * 0.8^3 = 51.2 → 51
      expect(applyDecay(100, 3)).toBe(51)
    })

    it('rounds to nearest integer', () => {
      // 50 * 0.8 = 40
      expect(applyDecay(50, 1)).toBe(40)
      // 75 * 0.8^3 = 38.4 → 38
      expect(applyDecay(75, 3)).toBe(38)
    })

    it('decays to near zero over many weeks', () => {
      const result = applyDecay(100, 20)
      expect(result).toBeLessThan(5)
    })
  })

  describe('activityTypeToPoints', () => {
    it('returns correct points for known activities', () => {
      expect(activityTypeToPoints('account_creation')).toBe(10)
      expect(activityTypeToPoints('property_view')).toBe(1)
      expect(activityTypeToPoints('property_save')).toBe(5)
      expect(activityTypeToPoints('tour_requested')).toBe(30)
      expect(activityTypeToPoints('cma_downloaded')).toBe(25)
      expect(activityTypeToPoints('contact_form_submitted')).toBe(15)
    })

    it('returns 0 for unknown activity type', () => {
      expect(activityTypeToPoints('unknown_activity')).toBe(0)
      expect(activityTypeToPoints('')).toBe(0)
    })
  })

  describe('constants', () => {
    it('LEAD_TIERS has 4 tiers', () => {
      expect(LEAD_TIERS).toHaveLength(4)
      expect(LEAD_TIERS).toContain('cold')
      expect(LEAD_TIERS).toContain('warm')
      expect(LEAD_TIERS).toContain('hot')
      expect(LEAD_TIERS).toContain('very_hot')
    })

    it('POINTS contains expected activity types', () => {
      expect(Object.keys(POINTS).length).toBeGreaterThan(10)
      expect(POINTS['property_view']).toBe(1)
      expect(POINTS['tour_requested']).toBe(30)
    })
  })
})
