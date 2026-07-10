import { describe, it, expect } from 'vitest'
import {
  validateSegment,
  upgradeLegacyFilters,
  describeSegment,
  EMPTY_SEGMENT,
  type CrmSegment,
} from './segment-ast'

describe('validateSegment', () => {
  it('accepts an empty root group (everyone)', () => {
    expect(() => validateSegment(EMPTY_SEGMENT)).not.toThrow()
    expect(validateSegment(EMPTY_SEGMENT)).toBe(EMPTY_SEGMENT)
  })

  it('accepts a well-formed nested AND/OR/NOT segment', () => {
    const ast: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [
        { field: 'stage', value: 'Lead' },
        {
          type: 'group',
          op: 'or',
          nodes: [
            { field: 'tag', op: 'has', value: 'audience:seller' },
            { field: 'tag', op: 'has', value: 'audience:buyer' },
          ],
        },
        { type: 'group', op: 'not', nodes: [{ field: 'tag', op: 'has', value: 'compliance:hard-stop' }] },
        { field: 'created', op: 'between', value: '2026-01-01', valueEnd: '2026-06-01' },
        { field: 'custom', key: 'lead_score', op: 'eq', value: 'A' },
      ],
    }
    expect(() => validateSegment(ast)).not.toThrow()
  })

  it('accepts a subdivision condition and rejects an empty value', () => {
    const ok: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [{ field: 'subdivision', value: 'West Hills' }],
    }
    expect(() => validateSegment(ok)).not.toThrow()
    expect(describeSegment(ok)).toBe('subdivision is West Hills')
    expect(() =>
      validateSegment({ type: 'group', op: 'and', nodes: [{ field: 'subdivision', value: '' }] }),
    ).toThrow(/requires a non-empty value/)
  })

  it('accepts subdivision contains/starts operators and describes them', () => {
    const contains: CrmSegment = {
      type: 'group', op: 'and', nodes: [{ field: 'subdivision', op: 'contains', value: 'Northwest Crossing' }],
    }
    expect(() => validateSegment(contains)).not.toThrow()
    expect(describeSegment(contains)).toBe('subdivision contains Northwest Crossing')

    const starts: CrmSegment = {
      type: 'group', op: 'and', nodes: [{ field: 'subdivision', op: 'starts', value: 'West Hills' }],
    }
    expect(() => validateSegment(starts)).not.toThrow()
    expect(describeSegment(starts)).toBe('subdivision starts with West Hills')

    expect(() =>
      validateSegment({ type: 'group', op: 'and', nodes: [{ field: 'subdivision', op: 'bogus', value: 'x' }] }),
    ).toThrow(/subdivision op must be/)
  })

  it('throws when the root is not a group', () => {
    expect(() => validateSegment({ field: 'stage', value: 'Lead' })).toThrow(/root must be a group/)
    expect(() => validateSegment(null)).toThrow(/root must be a group/)
    expect(() => validateSegment('nope')).toThrow(/root must be a group/)
  })

  it('throws on an unknown condition field', () => {
    const ast = { type: 'group', op: 'and', nodes: [{ field: 'zip', value: '97701' }] }
    expect(() => validateSegment(ast)).toThrow(/unknown condition field/)
  })

  it('throws on a bad group op', () => {
    const ast = { type: 'group', op: 'xor', nodes: [] }
    expect(() => validateSegment(ast)).toThrow(/group op must be/)
  })

  it('throws when a NOT group does not have exactly one child', () => {
    const ast = {
      type: 'group',
      op: 'not',
      nodes: [
        { field: 'stage', value: 'Lead' },
        { field: 'stage', value: 'Pending' },
      ],
    }
    expect(() => validateSegment(ast)).toThrow(/exactly one child/)
  })

  it('throws on an empty stage value', () => {
    const ast = { type: 'group', op: 'and', nodes: [{ field: 'stage', value: '  ' }] }
    expect(() => validateSegment(ast)).toThrow(/requires a non-empty value/)
  })

  it('throws on a bad tag op', () => {
    const ast = { type: 'group', op: 'and', nodes: [{ field: 'tag', op: 'maybe', value: 'x' }] }
    expect(() => validateSegment(ast)).toThrow(/tag op must be/)
  })

  it('throws on an invalid date value', () => {
    const ast = { type: 'group', op: 'and', nodes: [{ field: 'created', op: 'after', value: 'not-a-date' }] }
    expect(() => validateSegment(ast)).toThrow(/valid ISO date/)
  })

  it('throws when between is missing valueEnd', () => {
    const ast = { type: 'group', op: 'and', nodes: [{ field: 'created', op: 'between', value: '2026-01-01' }] }
    expect(() => validateSegment(ast)).toThrow(/between requires/)
  })

  it('throws on a custom condition missing its key', () => {
    const ast = { type: 'group', op: 'and', nodes: [{ field: 'custom', op: 'eq', value: 'x' }] }
    expect(() => validateSegment(ast)).toThrow(/custom requires a non-empty key/)
  })

  it('throws on a bad custom op', () => {
    const ast = { type: 'group', op: 'and', nodes: [{ field: 'custom', key: 'k', op: 'startsWith', value: 'x' }] }
    expect(() => validateSegment(ast)).toThrow(/custom op must be/)
  })

  it('allows custom has/missing without a value', () => {
    const has = { type: 'group', op: 'and', nodes: [{ field: 'custom', key: 'k', op: 'has' }] }
    const missing = { type: 'group', op: 'and', nodes: [{ field: 'custom', key: 'k', op: 'missing' }] }
    expect(() => validateSegment(has)).not.toThrow()
    expect(() => validateSegment(missing)).not.toThrow()
  })

  it('throws when group.nodes is not an array', () => {
    const ast = { type: 'group', op: 'and', nodes: 'oops' }
    expect(() => validateSegment(ast)).toThrow(/nodes must be an array/)
  })
})

describe('upgradeLegacyFilters', () => {
  it('maps an empty filter bag to an empty AND group', () => {
    const seg = upgradeLegacyFilters({})
    expect(seg).toEqual({ type: 'group', op: 'and', nodes: [] })
    expect(() => validateSegment(seg)).not.toThrow()
  })

  it('maps stage to an exact stage condition', () => {
    const seg = upgradeLegacyFilters({ stage: 'Lead' })
    expect(seg.nodes).toContainEqual({ field: 'stage', value: 'Lead' })
  })

  it('maps a single tag to one tag-has condition', () => {
    const seg = upgradeLegacyFilters({ tagsAny: ['audience:seller'] })
    expect(seg.nodes).toContainEqual({ field: 'tag', op: 'has', value: 'audience:seller' })
  })

  it('maps multiple tagsAny to an OR group of tag-has (overlaps semantics)', () => {
    const seg = upgradeLegacyFilters({ tagsAny: ['a', 'b'] })
    expect(seg.nodes).toContainEqual({
      type: 'group',
      op: 'or',
      nodes: [
        { field: 'tag', op: 'has', value: 'a' },
        { field: 'tag', op: 'has', value: 'b' },
      ],
    })
  })

  it('maps broker and q', () => {
    const seg = upgradeLegacyFilters({ broker: 'rebecca', q: 'smith' })
    expect(seg.nodes).toContainEqual({ field: 'assigned_broker', value: 'rebecca' })
    expect(seg.nodes).toContainEqual({ field: 'q', value: 'smith' })
  })

  it('ANDs all present filters together and is always valid', () => {
    const seg = upgradeLegacyFilters({ stage: 'Lead', tagsAny: ['x'], broker: 'matt', q: 'jane' })
    expect(seg.op).toBe('and')
    expect(seg.nodes).toHaveLength(4)
    expect(() => validateSegment(seg)).not.toThrow()
  })

  it('drops blank/whitespace-only filter values', () => {
    const seg = upgradeLegacyFilters({ stage: '  ', tagsAny: ['', '  '], broker: '', q: '   ' })
    expect(seg.nodes).toHaveLength(0)
  })
})

describe('describeSegment', () => {
  it('labels an empty segment as Everyone', () => {
    expect(describeSegment(EMPTY_SEGMENT)).toBe('Everyone')
  })

  it('labels a single stage condition', () => {
    const seg = upgradeLegacyFilters({ stage: 'Lead' })
    expect(describeSegment(seg)).toBe('stage is Lead')
  })

  it('labels an AND of stage + broker + q', () => {
    const seg = upgradeLegacyFilters({ stage: 'Lead', broker: 'matt', q: 'jane' })
    expect(describeSegment(seg)).toBe('stage is Lead and broker is matt and matches "jane"')
  })

  it('labels an OR group of tags (single redundant outer wrap stripped)', () => {
    const seg = upgradeLegacyFilters({ tagsAny: ['a', 'b'] })
    expect(describeSegment(seg)).toBe('tagged a or tagged b')
  })

  it('keeps parens around a nested OR inside a multi-term AND', () => {
    const seg = upgradeLegacyFilters({ stage: 'Lead', tagsAny: ['a', 'b'] })
    expect(describeSegment(seg)).toBe('stage is Lead and (tagged a or tagged b)')
  })

  it('labels a NOT group', () => {
    const seg: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [{ type: 'group', op: 'not', nodes: [{ field: 'tag', op: 'has', value: 'compliance:hard-stop' }] }],
    }
    expect(describeSegment(seg)).toBe('not (tagged compliance:hard-stop)')
  })

  it('labels date and custom conditions', () => {
    const seg: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [
        { field: 'created', op: 'between', value: '2026-01-01', valueEnd: '2026-06-01' },
        { field: 'custom', key: 'lead_score', op: 'eq', value: 'A' },
        { field: 'last_activity', op: 'after', value: '2026-05-01' },
      ],
    }
    expect(describeSegment(seg)).toBe(
      'created 2026-01-01 to 2026-06-01 and lead_score is A and last active after 2026-05-01',
    )
  })
})
