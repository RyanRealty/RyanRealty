import { describe, it, expect } from 'vitest'
import {
  formatCustomFieldDisplay,
  groupAndFormat,
  humanizeCustomKey,
  UNDEFINED_FIELD_GROUP,
} from './custom-field-display'
import type { CrmFieldDefinition } from '@/lib/data/crm/getCrmFieldDefinitions'

function def(partial: Partial<CrmFieldDefinition> & Pick<CrmFieldDefinition, 'key' | 'type'>): CrmFieldDefinition {
  return {
    id: 1,
    label: partial.key,
    options: [],
    position: 0,
    hideIfEmpty: false,
    readOnly: false,
    fieldGroup: null,
    isProtected: false,
    ...partial,
  }
}

describe('formatCustomFieldDisplay', () => {
  it('number → locale-grouped string', () => {
    expect(formatCustomFieldDisplay(def({ key: 'budget', type: 'number' }), 1250000)).toBe('1,250,000')
  })

  it('number → null for a non-finite/non-number value', () => {
    expect(formatCustomFieldDisplay(def({ key: 'budget', type: 'number' }), 'nope' as unknown as number)).toBeNull()
  })

  it('date → brand-formatted date', () => {
    expect(formatCustomFieldDisplay(def({ key: 'closed', type: 'date' }), '2026-06-22')).toBe('Jun 22, 2026')
  })

  it('date → null when formatDate yields the placeholder', () => {
    expect(formatCustomFieldDisplay(def({ key: 'closed', type: 'date' }), 'not-a-date')).toBeNull()
  })

  it('select → the option label, not the stored value', () => {
    const d = def({
      key: 'tier',
      type: 'select',
      options: [{ value: 'a', label: 'A-list' }, { value: 'b', label: 'B-list' }],
    })
    expect(formatCustomFieldDisplay(d, 'a')).toBe('A-list')
  })

  it('select → raw value when no matching option', () => {
    const d = def({ key: 'tier', type: 'select', options: [{ value: 'a', label: 'A-list' }] })
    expect(formatCustomFieldDisplay(d, 'z')).toBe('z')
  })

  it('text → trimmed string', () => {
    expect(formatCustomFieldDisplay(def({ key: 'note', type: 'text' }), 'hello')).toBe('hello')
  })

  it('null value → null for every type', () => {
    expect(formatCustomFieldDisplay(def({ key: 'x', type: 'text' }), null)).toBeNull()
    expect(formatCustomFieldDisplay(def({ key: 'x', type: 'number' }), null)).toBeNull()
  })
})

describe('groupAndFormat', () => {
  it('orders rows by position then label', () => {
    const defs = [
      def({ key: 'b', label: 'Beta', type: 'text', position: 2 }),
      def({ key: 'a', label: 'Alpha', type: 'text', position: 1 }),
    ]
    const custom = { a: 'one', b: 'two' }
    const groups = groupAndFormat(custom, defs)
    expect(groups).toHaveLength(1)
    expect(groups[0].rows.map((r) => r.key)).toEqual(['a', 'b'])
  })

  it('buckets by field_group with ungrouped last', () => {
    const defs = [
      def({ key: 'a', label: 'A', type: 'text', fieldGroup: 'Buyer', position: 1 }),
      def({ key: 'b', label: 'B', type: 'text', fieldGroup: null, position: 2 }),
      def({ key: 'c', label: 'C', type: 'text', fieldGroup: 'Seller', position: 3 }),
    ]
    const groups = groupAndFormat({ a: 'x', b: 'y', c: 'z' }, defs)
    expect(groups.map((g) => g.group)).toEqual(['Buyer', 'Seller', null])
  })

  it('drops a hideIfEmpty field with no value', () => {
    const defs = [
      def({ key: 'present', label: 'Present', type: 'text', hideIfEmpty: true }),
      def({ key: 'missing', label: 'Missing', type: 'text', hideIfEmpty: true }),
    ]
    const groups = groupAndFormat({ present: 'here' }, defs)
    expect(groups[0].rows.map((r) => r.key)).toEqual(['present'])
  })

  it('omits an empty typed field on the person card (populated-only, FUB parity)', () => {
    // A typed field with no value for this contact is dropped, not rendered as
    // an em-dash — the card shows only fields that actually have data.
    const defs = [
      def({ key: 'present', label: 'Present', type: 'text' }),
      def({ key: 'missing', label: 'Missing', type: 'text', hideIfEmpty: false }),
    ]
    const groups = groupAndFormat({ present: 'here' }, defs)
    expect(groups[0].rows.map((r) => r.key)).toEqual(['present'])
  })

  it('marks number and date rows as tabular, text/select as not', () => {
    const defs = [
      def({ key: 'n', label: 'N', type: 'number', position: 1 }),
      def({ key: 'd', label: 'D', type: 'date', position: 2 }),
      def({ key: 't', label: 'T', type: 'text', position: 3 }),
    ]
    const groups = groupAndFormat({ n: 5, d: '2026-01-01', t: 'hi' }, defs)
    const byKey = Object.fromEntries(groups[0].rows.map((r) => [r.key, r.tabular]))
    expect(byKey).toEqual({ n: true, d: true, t: false })
  })

  it('returns an empty array when every field is empty + hideIfEmpty', () => {
    const defs = [def({ key: 'a', label: 'A', type: 'text', hideIfEmpty: true })]
    expect(groupAndFormat({}, defs)).toEqual([])
  })

  it('tolerates a null custom bag', () => {
    const defs = [def({ key: 'a', label: 'A', type: 'text', hideIfEmpty: true })]
    expect(groupAndFormat(null, defs)).toEqual([])
  })

  // ── Fallback rendering: populated keys with NO definition (the regression) ──
  it('renders populated custom keys that have NO definition (the "just names" fix)', () => {
    // The real FUB enrichment bag: custom-prefixed keys the registry never declared.
    const custom = {
      customYearBuilt: '1977',
      customSubdivision: 'Deschutes RiverWoods',
      customSellerPropertyAddress: '18949 Baker, Bend, OR 97702',
      customClassification: 'EXPIRED',
    }
    const groups = groupAndFormat(custom, []) // zero definitions match
    expect(groups).toHaveLength(1)
    expect(groups[0].group).toBe(UNDEFINED_FIELD_GROUP)
    const byLabel = Object.fromEntries(groups[0].rows.map((r) => [r.label, r.display]))
    expect(byLabel).toEqual({
      'Classification': 'EXPIRED',
      'Seller Property Address': '18949 Baker, Bend, OR 97702',
      'Subdivision': 'Deschutes RiverWoods',
      'Year Built': '1977',
    })
  })

  it('keeps typed groups first and puts undefined keys in a trailing Enrichment bucket', () => {
    const defs = [def({ key: 'stage', label: 'Stage', type: 'text', fieldGroup: 'Buyer', position: 1 })]
    const groups = groupAndFormat({ stage: 'hot', customYearBuilt: '1977' }, defs)
    expect(groups.map((g) => g.group)).toEqual(['Buyer', UNDEFINED_FIELD_GROUP])
  })

  it('does not duplicate a key that already has a definition', () => {
    const defs = [def({ key: 'customYearBuilt', label: 'Year', type: 'text' })]
    const groups = groupAndFormat({ customYearBuilt: '1977' }, defs)
    const allRows = groups.flatMap((g) => g.rows)
    expect(allRows.filter((r) => r.key === 'customYearBuilt')).toHaveLength(1)
    expect(groups.some((g) => g.group === UNDEFINED_FIELD_GROUP)).toBe(false)
  })

  it('drops empty undefined values', () => {
    const groups = groupAndFormat({ customA: '', customB: null, customC: 'keep' }, [])
    expect(groups).toHaveLength(1)
    expect(groups[0].rows.map((r) => r.key)).toEqual(['customC'])
  })
})

describe('humanizeCustomKey', () => {
  it('strips the custom prefix and splits camelCase into Title Case', () => {
    expect(humanizeCustomKey('customSellerPropertyAddress')).toBe('Seller Property Address')
    expect(humanizeCustomKey('customYearBuilt')).toBe('Year Built')
    expect(humanizeCustomKey('customSubdivision')).toBe('Subdivision')
  })

  it('handles acronym runs and non-prefixed keys', () => {
    expect(humanizeCustomKey('customMLSNumber')).toBe('MLS Number')
    expect(humanizeCustomKey('customAPN')).toBe('APN')
    expect(humanizeCustomKey('bareKey')).toBe('Bare Key')
  })
})
