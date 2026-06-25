import { describe, it, expect } from 'vitest'
import {
  formatCustomFieldDisplay,
  groupAndFormat,
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

  it('keeps a non-hideIfEmpty empty field as an em-dash placeholder', () => {
    const defs = [def({ key: 'missing', label: 'Missing', type: 'text', hideIfEmpty: false })]
    const groups = groupAndFormat({}, defs)
    expect(groups[0].rows[0].display).toBe('—')
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
})
