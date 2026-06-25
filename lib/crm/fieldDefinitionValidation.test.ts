import { describe, it, expect } from 'vitest'
import { validateFieldKey, validateCreateInput, buildUpdatePatch } from './fieldDefinitionValidation'

describe('validateFieldKey', () => {
  it('accepts a clean machine key', () => {
    expect(validateFieldKey('leadScore')).toEqual({ ok: true, key: 'leadScore' })
    expect(validateFieldKey('  buyer_budget_max  ')).toEqual({ ok: true, key: 'buyer_budget_max' })
    expect(validateFieldKey('a1_b2')).toEqual({ ok: true, key: 'a1_b2' })
  })
  it('rejects empty / non-string', () => {
    expect(validateFieldKey('').ok).toBe(false)
    expect(validateFieldKey('   ').ok).toBe(false)
    expect(validateFieldKey(null).ok).toBe(false)
    expect(validateFieldKey(42).ok).toBe(false)
  })
  it('rejects keys that do not start with a letter or use bad characters', () => {
    expect(validateFieldKey('1score').ok).toBe(false)
    expect(validateFieldKey('_score').ok).toBe(false)
    expect(validateFieldKey('lead score').ok).toBe(false)
    expect(validateFieldKey('lead-score').ok).toBe(false)
    expect(validateFieldKey('lead.score').ok).toBe(false)
  })
  it('rejects an over-long key', () => {
    expect(validateFieldKey('a'.repeat(65)).ok).toBe(false)
    expect(validateFieldKey('a'.repeat(64)).ok).toBe(true)
  })
})

describe('validateCreateInput', () => {
  it('builds a clean DB row from a valid text field', () => {
    const res = validateCreateInput({ key: 'neighborhood', label: 'Neighborhood', type: 'text', position: 5 })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.row).toMatchObject({
        key: 'neighborhood',
        label: 'Neighborhood',
        type: 'text',
        options: [],
        position: 5,
        hide_if_empty: false,
        read_only: false,
        field_group: null,
      })
    }
  })

  it('requires a label', () => {
    expect(validateCreateInput({ key: 'x', label: '   ' }).ok).toBe(false)
  })

  it('requires at least one option for a select field', () => {
    expect(validateCreateInput({ key: 'tier', label: 'Tier', type: 'select', options: [] }).ok).toBe(false)
    const ok = validateCreateInput({
      key: 'tier',
      label: 'Tier',
      type: 'select',
      options: [{ value: 'hot', label: 'Hot' }],
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.row.options).toEqual([{ value: 'hot', label: 'Hot' }])
  })

  it('drops options for non-select types', () => {
    const res = validateCreateInput({
      key: 'score',
      label: 'Score',
      type: 'number',
      options: [{ value: 'a', label: 'A' }],
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.row.options).toEqual([])
  })

  it('rejects an invalid type', () => {
    // @ts-expect-error testing a bad runtime type
    expect(validateCreateInput({ key: 'x', label: 'X', type: 'boolean' }).ok).toBe(false)
  })

  it('defaults position to 0 and trims a field group', () => {
    const res = validateCreateInput({ key: 'x', label: 'X', fieldGroup: '  Buyer  ' })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.row.position).toBe(0)
      expect(res.row.field_group).toBe('Buyer')
    }
  })
})

describe('buildUpdatePatch', () => {
  it('returns an empty patch when nothing is supplied (the key stays immutable)', () => {
    const res = buildUpdatePatch({})
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.patch).toEqual({})
      expect('key' in res.patch).toBe(false)
    }
  })

  it('patches only the supplied attributes', () => {
    const res = buildUpdatePatch({ label: 'New Label', position: 3, hideIfEmpty: true })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.patch).toEqual({ label: 'New Label', position: 3, hide_if_empty: true })
  })

  it('clears options when switching a field away from select', () => {
    const res = buildUpdatePatch({ type: 'number' })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.patch).toEqual({ type: 'number', options: [] })
  })

  it('requires options when switching a field to select', () => {
    expect(buildUpdatePatch({ type: 'select' }).ok).toBe(false)
    const ok = buildUpdatePatch({ type: 'select', options: [{ value: 'y', label: 'Y' }] })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.patch.options).toEqual([{ value: 'y', label: 'Y' }])
  })

  it('rejects an empty label', () => {
    expect(buildUpdatePatch({ label: '  ' }).ok).toBe(false)
  })

  it('rejects an invalid type', () => {
    // @ts-expect-error bad runtime type
    expect(buildUpdatePatch({ type: 'json' }).ok).toBe(false)
  })
})
