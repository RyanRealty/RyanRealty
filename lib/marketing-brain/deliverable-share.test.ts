/**
 * Unit test for the share-to-social safety rules (W10.6).
 *
 * The load-bearing property: a client's CMA (and every internal/private
 * deliverable) can never be offered for sharing to a public feed. Sharing a CMA
 * to Instagram would expose a client's confidential pricing.
 */
import { describe, expect, it } from 'vitest'
import {
  isShareableToSocial,
  captionFor,
  SHAREABLE_TYPE_KEYS,
} from './deliverable-share'
import { checkBrandVoice } from '@/lib/voice/check'

const PRIVATE = [
  'content:cma',
  'content-cma.json',
  'content:bpo',
  'comms:matt_summary',
  'comms:matt_alert',
  'analyze:audit_findings',
  'ops:meta_budget',
  'site:cta_update',
  'content:test',
]

describe('deliverable share-to-social safety (W10.6)', () => {
  it('never marks a CMA, BPO, or internal deliverable shareable', () => {
    for (const t of PRIVATE) {
      expect(isShareableToSocial(t), `${t} must not be shareable`).toBe(false)
      expect(captionFor(t), `${t} must have no caption`).toBe('')
    }
  })

  it('blocks a VERSIONED or suffixed CMA/BPO relabel (prefix denylist)', () => {
    // A demonstrated leak: the exact-match denylist let content:cma_v2 through.
    // The repo already versions CMA methodology, so this is an ordinary refactor.
    for (const t of [
      'content:cma_v2',
      'content-cma-v2.json',
      'content:cma_expired',
      'content-cma-expired.json',
      'content:bpo_v3',
      'content-bpo-final.json',
    ]) {
      expect(isShareableToSocial(t), `${t} must not be shareable`).toBe(false)
    }
  })

  it('default-denies an unknown or empty type', () => {
    expect(isShareableToSocial('content:brand_new_unknown')).toBe(false)
    expect(isShareableToSocial('')).toBe(false)
    expect(isShareableToSocial('totally-made-up.json')).toBe(false)
  })

  it('marks genuine public content shareable, in both spellings', () => {
    expect(isShareableToSocial('content:blog_post')).toBe(true)
    expect(isShareableToSocial('content-blog-post.json')).toBe(true)
    expect(isShareableToSocial('content:ig_carousel')).toBe(true)
    expect(isShareableToSocial('content:market_report_blog')).toBe(true)
  })

  it('gives every shareable type a caption that carries no fabricated number', () => {
    for (const key of SHAREABLE_TYPE_KEYS) {
      const cap = captionFor(key)
      expect(cap.length, `${key} has no caption`).toBeGreaterThan(0)
      // no digits — the caption is qualitative, the broker adds specifics (§0)
      expect(/\d/.test(cap), `${key} caption fabricates a number: ${cap}`).toBe(false)
    }
  })

  it('every caption passes the brand-voice check', () => {
    for (const key of SHAREABLE_TYPE_KEYS) {
      const result = checkBrandVoice(captionFor(key))
      expect(result.ok, `${key} caption fails brand voice: ${JSON.stringify(result)}`).toBe(true)
    }
  })
})
