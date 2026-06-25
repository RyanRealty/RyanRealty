import { describe, it, expect } from 'vitest'
import { rewriteTagsArray, stripTagFromArray } from './tag-rewrite'

describe('rewriteTagsArray (rename)', () => {
  it('replaces every occurrence of the old key with the new key', () => {
    expect(rewriteTagsArray(['Seller', 'audience:buyer'], 'Seller', 'audience:seller')).toEqual({
      tags: ['audience:seller', 'audience:buyer'],
      changed: true,
    })
  })

  it('preserves first-seen order', () => {
    expect(rewriteTagsArray(['a', 'b', 'c'], 'b', 'z')).toEqual({
      tags: ['a', 'z', 'c'],
      changed: true,
    })
  })

  it('reports changed=false when the key is absent', () => {
    expect(rewriteTagsArray(['a', 'b'], 'x', 'y')).toEqual({ tags: ['a', 'b'], changed: false })
  })

  it('reports changed=false for a no-op rename (from === into)', () => {
    expect(rewriteTagsArray(['a', 'b'], 'a', 'a')).toEqual({ tags: ['a', 'b'], changed: false })
  })

  it('treats an empty from-key as a no-op', () => {
    expect(rewriteTagsArray(['a', 'b'], '', 'y')).toEqual({ tags: ['a', 'b'], changed: false })
  })

  it('handles a null/undefined tags array', () => {
    expect(rewriteTagsArray(null, 'a', 'b')).toEqual({ tags: [], changed: false })
    expect(rewriteTagsArray(undefined, 'a', 'b')).toEqual({ tags: [], changed: false })
  })
})

describe('rewriteTagsArray (merge collision + dedupe)', () => {
  it('collapses to a single target when the person already carries it', () => {
    // merge "Seller" into "audience:seller" on a person who already has both
    expect(rewriteTagsArray(['Seller', 'audience:seller'], 'Seller', 'audience:seller')).toEqual({
      tags: ['audience:seller'],
      changed: true,
    })
  })

  it('de-duplicates a pre-existing duplicate even without a rename hit', () => {
    expect(rewriteTagsArray(['a', 'a', 'b'], 'x', 'y')).toEqual({ tags: ['a', 'b'], changed: true })
  })

  it('keeps the first position of the target when merging in from a later slot', () => {
    expect(rewriteTagsArray(['audience:seller', 'x', 'Seller'], 'Seller', 'audience:seller')).toEqual({
      tags: ['audience:seller', 'x'],
      changed: true,
    })
  })

  it('drops empty strings produced by a rename into the empty string', () => {
    expect(rewriteTagsArray(['a', 'b'], 'a', '')).toEqual({ tags: ['b'], changed: true })
  })
})

describe('stripTagFromArray (delete-with-strip)', () => {
  it('removes every occurrence of the key', () => {
    expect(stripTagFromArray(['a', 'b', 'a'], 'a')).toEqual({ tags: ['b'], changed: true })
  })

  it('reports changed=false when the key is absent', () => {
    expect(stripTagFromArray(['a', 'b'], 'x')).toEqual({ tags: ['a', 'b'], changed: false })
  })

  it('de-duplicates the remainder while stripping', () => {
    expect(stripTagFromArray(['a', 'b', 'b', 'c'], 'a')).toEqual({ tags: ['b', 'c'], changed: true })
  })

  it('treats an empty key as a no-op', () => {
    expect(stripTagFromArray(['a', 'b'], '')).toEqual({ tags: ['a', 'b'], changed: false })
  })

  it('handles a null tags array', () => {
    expect(stripTagFromArray(null, 'a')).toEqual({ tags: [], changed: false })
  })
})
