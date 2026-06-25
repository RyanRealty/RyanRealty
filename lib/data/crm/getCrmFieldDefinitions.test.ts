import { describe, it, expect } from 'vitest'
import {
  normalizeFieldType,
  normalizeFieldOptions,
  mapFieldDefinitionRow,
  getCrmFieldValue,
  CRM_FIELD_TYPES,
  type CrmFieldDefinition,
} from './getCrmFieldDefinitions'

describe('normalizeFieldType', () => {
  it('passes through the four valid types', () => {
    for (const t of CRM_FIELD_TYPES) expect(normalizeFieldType(t)).toBe(t)
  })
  it('defaults anything else to text', () => {
    expect(normalizeFieldType('boolean')).toBe('text')
    expect(normalizeFieldType('')).toBe('text')
    expect(normalizeFieldType(null)).toBe('text')
    expect(normalizeFieldType(undefined)).toBe('text')
    expect(normalizeFieldType(7)).toBe('text')
  })
})

describe('normalizeFieldOptions', () => {
  it('keeps well-formed { value, label } pairs', () => {
    expect(
      normalizeFieldOptions([
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]),
    ).toEqual([
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ])
  })
  it('falls back the label to the value when label is missing or empty', () => {
    expect(normalizeFieldOptions([{ value: 'hot' }, { value: 'warm', label: '' }])).toEqual([
      { value: 'hot', label: 'hot' },
      { value: 'warm', label: 'warm' },
    ])
  })
  it('drops non-string values and non-objects', () => {
    expect(normalizeFieldOptions([{ value: 1 }, 'nope', null, { label: 'x' }])).toEqual([])
  })
  it('returns [] for a non-array', () => {
    expect(normalizeFieldOptions(null)).toEqual([])
    expect(normalizeFieldOptions('a,b')).toEqual([])
    expect(normalizeFieldOptions(undefined)).toEqual([])
  })
})

describe('mapFieldDefinitionRow', () => {
  it('maps a full DB row to the typed shape', () => {
    const def = mapFieldDefinitionRow({
      id: 12,
      key: 'leadScore',
      label: 'Lead Score',
      type: 'number',
      options: [],
      position: 10,
      hide_if_empty: true,
      read_only: true,
      field_group: 'Engagement',
      is_protected: true,
    })
    expect(def).toEqual({
      id: 12,
      key: 'leadScore',
      label: 'Lead Score',
      type: 'number',
      options: [],
      position: 10,
      hideIfEmpty: true,
      readOnly: true,
      fieldGroup: 'Engagement',
      isProtected: true,
    } satisfies CrmFieldDefinition)
  })
  it('coerces missing/odd values to safe defaults', () => {
    const def = mapFieldDefinitionRow({ id: '3', key: 'x', label: 'X', type: 'mystery', position: 'NaN' })
    expect(def.id).toBe(3)
    expect(def.type).toBe('text')
    expect(def.position).toBe(0)
    expect(def.options).toEqual([])
    expect(def.hideIfEmpty).toBe(false)
    expect(def.readOnly).toBe(false)
    expect(def.fieldGroup).toBeNull()
    expect(def.isProtected).toBe(false)
  })
})

describe('getCrmFieldValue', () => {
  const numberDef = { key: 'leadScore', type: 'number' as const, options: [] }
  const dateDef = { key: 'purchaseDate', type: 'date' as const, options: [] }
  const textDef = { key: 'neighborhood', type: 'text' as const, options: [] }
  const selectDef = {
    key: 'isSellerCurious',
    type: 'select' as const,
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  }

  it('returns null when custom is missing or the key is absent', () => {
    expect(getCrmFieldValue(null, numberDef)).toBeNull()
    expect(getCrmFieldValue(undefined, numberDef)).toBeNull()
    expect(getCrmFieldValue({}, numberDef)).toBeNull()
    expect(getCrmFieldValue({ leadScore: null }, numberDef)).toBeNull()
    expect(getCrmFieldValue({ leadScore: undefined }, numberDef)).toBeNull()
  })

  it('coerces number values (from number and numeric string)', () => {
    expect(getCrmFieldValue({ leadScore: 87 }, numberDef)).toBe(87)
    expect(getCrmFieldValue({ leadScore: '42' }, numberDef)).toBe(42)
    expect(getCrmFieldValue({ leadScore: ' 5.5 ' }, numberDef)).toBe(5.5)
  })
  it('returns null for a non-numeric number value', () => {
    expect(getCrmFieldValue({ leadScore: 'high' }, numberDef)).toBeNull()
    expect(getCrmFieldValue({ leadScore: '' }, numberDef)).toBeNull()
  })

  it('normalizes a date value to YYYY-MM-DD', () => {
    expect(getCrmFieldValue({ purchaseDate: '2024-03-09' }, dateDef)).toBe('2024-03-09')
    expect(getCrmFieldValue({ purchaseDate: '2024-03-09T00:00:00Z' }, dateDef)).toBe('2024-03-09')
  })
  it('returns null for an unparseable date', () => {
    expect(getCrmFieldValue({ purchaseDate: 'someday' }, dateDef)).toBeNull()
    expect(getCrmFieldValue({ purchaseDate: '' }, dateDef)).toBeNull()
  })

  it('returns a select value only when it matches a defined option', () => {
    expect(getCrmFieldValue({ isSellerCurious: 'yes' }, selectDef)).toBe('yes')
    expect(getCrmFieldValue({ isSellerCurious: 'maybe' }, selectDef)).toBeNull()
  })

  it('returns a trimmed text value, or null when empty', () => {
    expect(getCrmFieldValue({ neighborhood: '  Awbrey Butte  ' }, textDef)).toBe('Awbrey Butte')
    expect(getCrmFieldValue({ neighborhood: '   ' }, textDef)).toBeNull()
    expect(getCrmFieldValue({ neighborhood: 123 }, textDef)).toBe('123')
  })
})
