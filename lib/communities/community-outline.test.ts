import { describe, expect, it } from 'vitest'
import registry from '@/data/resort-communities.json'
import baseline from '@/data/boundary-sanity-baseline.json'
import {
  communityOutlineRef,
  isCommunityOutlineTrusted,
  outlineTrustedUnder,
  trustedCommunityOutlineSlug,
} from './community-outline'
import { publicCommunitySlug } from './community-public-pair'

type Entry = { slug: string; label: string; former_labels?: string[] }
const ENTRIES = (registry as unknown as { communities: Entry[] }).communities

describe('community outline keying (registry slug, never the URL)', () => {
  it('keys every registered community, by its public URL and its durable slug, to its durable slug', () => {
    expect(ENTRIES.length).toBeGreaterThanOrEqual(19)
    for (const entry of ENTRIES) {
      expect(communityOutlineRef(publicCommunitySlug(entry))?.outlineSlug, publicCommunitySlug(entry)).toBe(entry.slug)
      expect(communityOutlineRef(entry.slug)?.outlineSlug, entry.slug).toBe(entry.slug)
    }
  })

  it('reads Juniper Preserve from the row stored as pronghorn', () => {
    expect(communityOutlineRef('juniper-preserve')).toEqual({ outlineSlug: 'pronghorn', trusted: true })
    expect(trustedCommunityOutlineSlug('juniper-preserve')).toBe('pronghorn')
    expect(communityOutlineRef('pronghorn')?.outlineSlug).toBe('pronghorn')
  })

  it('gives a slug that is not a registry community no outline, however it is spelled', () => {
    expect(communityOutlineRef('bend-awbrey-butte')).toBeNull()
    expect(communityOutlineRef('crr')).toBeNull()
    expect(communityOutlineRef('')).toBeNull()
    expect(trustedCommunityOutlineSlug('no-such-place')).toBeNull()
  })

  it('normalises case and whitespace in the URL slug', () => {
    expect(communityOutlineRef('  Juniper-Preserve ')?.outlineSlug).toBe('pronghorn')
  })
})

describe('the one trust rule', () => {
  it('trusts an outline unless the baseline lists it as awaiting correction', () => {
    const untrusted = new Set(['widgi-creek'])
    expect(outlineTrustedUnder(untrusted, 'widgi-creek')).toBe(false)
    expect(outlineTrustedUnder(untrusted, ' Widgi-Creek ')).toBe(false)
    expect(outlineTrustedUnder(untrusted, 'tetherow')).toBe(true)
    expect(outlineTrustedUnder(new Set(), 'widgi-creek')).toBe(true)
  })

  it('answers from data/boundary-sanity-baseline.json `allowed`, and nothing else', () => {
    const allowed = new Set((baseline as { allowed: string[] }).allowed)
    for (const entry of ENTRIES) {
      expect(isCommunityOutlineTrusted(entry.slug), entry.slug).toBe(!allowed.has(entry.slug))
      expect(communityOutlineRef(publicCommunitySlug(entry))?.trusted, entry.slug).toBe(!allowed.has(entry.slug))
      expect(trustedCommunityOutlineSlug(publicCommunitySlug(entry))).toBe(allowed.has(entry.slug) ? null : entry.slug)
    }
  })

  it('trusts the outlines the 2026-08-23 rebuild corrected (the stale baseline hid Sunriver, Brasada Ranch and Three Rivers)', () => {
    for (const slug of ['sunriver', 'brasada-ranch', 'three-rivers', 'broken-top', 'eagle-crest', 'widgi-creek']) {
      expect(isCommunityOutlineTrusted(slug), slug).toBe(true)
    }
  })
})
