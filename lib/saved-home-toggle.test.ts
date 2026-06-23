import { describe, it, expect } from 'vitest'
import {
  planSavedHomeRemoval,
  nextSavedHomeState,
  normalizeListingKey,
} from './saved-home-toggle'

describe('saved-home-toggle', () => {
  describe('planSavedHomeRemoval', () => {
    it('clears BOTH stores when membership is unknown (the no-op-bug fix)', () => {
      // This is the case the old RemoveSavedButton got wrong: it only deleted
      // from saved_listings, so a liked-only home was never removed.
      expect(planSavedHomeRemoval()).toEqual({ removeSaved: true, removeLiked: true })
      expect(planSavedHomeRemoval(undefined)).toEqual({ removeSaved: true, removeLiked: true })
      expect(planSavedHomeRemoval({})).toEqual({ removeSaved: true, removeLiked: true })
    })

    it('removes from likes when the home is liked-only', () => {
      expect(planSavedHomeRemoval({ inSaved: false, inLiked: true })).toEqual({
        removeSaved: false,
        removeLiked: true,
      })
    })

    it('removes from saved_listings when the home is bookmarked-only', () => {
      expect(planSavedHomeRemoval({ inSaved: true, inLiked: false })).toEqual({
        removeSaved: true,
        removeLiked: false,
      })
    })

    it('removes from both when the home is in both stores', () => {
      expect(planSavedHomeRemoval({ inSaved: true, inLiked: true })).toEqual({
        removeSaved: true,
        removeLiked: true,
      })
    })

    it('removes from neither when the home is in neither store', () => {
      expect(planSavedHomeRemoval({ inSaved: false, inLiked: false })).toEqual({
        removeSaved: false,
        removeLiked: false,
      })
    })
  })

  describe('nextSavedHomeState', () => {
    it('toggles a liked-only home OFF and removes it from likes', () => {
      expect(nextSavedHomeState({ inSaved: false, inLiked: true })).toEqual({
        willBeSaved: false,
        removal: { removeSaved: false, removeLiked: true },
      })
    })

    it('toggles a bookmarked-only home OFF and removes it from saved_listings', () => {
      expect(nextSavedHomeState({ inSaved: true, inLiked: false })).toEqual({
        willBeSaved: false,
        removal: { removeSaved: true, removeLiked: false },
      })
    })

    it('toggles an in-both home OFF and removes it from both', () => {
      expect(nextSavedHomeState({ inSaved: true, inLiked: true })).toEqual({
        willBeSaved: false,
        removal: { removeSaved: true, removeLiked: true },
      })
    })

    it('toggles an unsaved home ON without removing anything', () => {
      expect(nextSavedHomeState({ inSaved: false, inLiked: false })).toEqual({
        willBeSaved: true,
        removal: { removeSaved: false, removeLiked: false },
      })
    })

    it('treats unknown membership as unsaved (toggles ON)', () => {
      expect(nextSavedHomeState()).toEqual({
        willBeSaved: true,
        removal: { removeSaved: false, removeLiked: false },
      })
    })
  })

  describe('normalizeListingKey', () => {
    it('trims whitespace', () => {
      expect(normalizeListingKey('  220189422  ')).toBe('220189422')
    })

    it('returns empty string for null/undefined', () => {
      expect(normalizeListingKey(null)).toBe('')
      expect(normalizeListingKey(undefined)).toBe('')
    })
  })
})
