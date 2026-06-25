import { describe, it, expect } from 'vitest'
import { groupSavedViews, legacyToPreview, type SavedViewItem } from './saved-view-grouping'
import { describeSegment, validateSegment } from '@/lib/crm/segment-ast'

function view(over: Partial<SavedViewItem> & { id: number }): SavedViewItem {
  return {
    name: `view-${over.id}`,
    description: null,
    ast: { type: 'group', op: 'and', nodes: [] },
    isShared: false,
    isProtected: false,
    isSystem: false,
    isOwn: false,
    count: 0,
    ...over,
  }
}

describe('groupSavedViews', () => {
  it('buckets system / own / shared disjointly and total-preserving', () => {
    const views = [
      view({ id: 1, isSystem: true, isProtected: true }),
      view({ id: 2, isOwn: true }),
      view({ id: 3, isShared: true }), // someone else's shared view (not own, not system)
      view({ id: 4, isSystem: true, isProtected: true }),
      view({ id: 5, isOwn: true }),
    ]
    const { system, mine, shared } = groupSavedViews(views)
    expect(system.map((v) => v.id)).toEqual([1, 4])
    expect(mine.map((v) => v.id)).toEqual([2, 5])
    expect(shared.map((v) => v.id)).toEqual([3])
    // disjoint + total-preserving
    expect(system.length + mine.length + shared.length).toBe(views.length)
  })

  it('a system view that also looks own still buckets as system (system wins)', () => {
    const { system, mine, shared } = groupSavedViews([
      view({ id: 1, isSystem: true, isOwn: true }),
    ])
    expect(system.map((v) => v.id)).toEqual([1])
    expect(mine).toEqual([])
    expect(shared).toEqual([])
  })

  it('preserves input order within each bucket', () => {
    const { mine } = groupSavedViews([
      view({ id: 9, isOwn: true }),
      view({ id: 2, isOwn: true }),
      view({ id: 7, isOwn: true }),
    ])
    expect(mine.map((v) => v.id)).toEqual([9, 2, 7])
  })

  it('returns empty buckets for an empty input', () => {
    expect(groupSavedViews([])).toEqual({ system: [], mine: [], shared: [] })
  })
})

describe('legacyToPreview', () => {
  it('an empty filter bag yields the everyone segment', () => {
    const seg = legacyToPreview({})
    expect(seg).toEqual({ type: 'group', op: 'and', nodes: [] })
    expect(describeSegment(seg)).toBe('Everyone')
  })

  it('maps stage / broker / q to their conditions', () => {
    const seg = legacyToPreview({ stage: 'Lead', broker: 'rebecca', q: 'smith' })
    expect(seg.nodes).toEqual([
      { field: 'stage', value: 'Lead' },
      { field: 'assigned_broker', value: 'rebecca' },
      { field: 'q', value: 'smith' },
    ])
  })

  it('maps each tag to its own has-condition and skips empties', () => {
    const seg = legacyToPreview({ tagsAny: ['audience:seller', '', 'audience:buyer'] })
    expect(seg.nodes).toEqual([
      { field: 'tag', op: 'has', value: 'audience:seller' },
      { field: 'tag', op: 'has', value: 'audience:buyer' },
    ])
  })

  it('produces a segment that always validates', () => {
    const seg = legacyToPreview({ stage: 'Lead', tagsAny: ['x'], broker: 'paul', q: 'a' })
    expect(() => validateSegment(seg)).not.toThrow()
  })
})
