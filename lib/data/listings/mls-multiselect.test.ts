import { describe, it, expect } from 'vitest'
import { cleanText, formatMlsMultiSelect } from './mls-multiselect'

describe('cleanText', () => {
  it('passes a real string through, trimmed', () => {
    expect(cleanText('  Frame ')).toBe('Frame')
  })
  it('drops the MLS privacy sentinel and empties to null', () => {
    expect(cleanText('********')).toBeNull()
    expect(cleanText('***')).toBeNull()
    expect(cleanText('')).toBeNull()
    expect(cleanText('   ')).toBeNull()
    expect(cleanText(null)).toBeNull()
    expect(cleanText(undefined)).toBeNull()
  })
})

describe('formatMlsMultiSelect', () => {
  it('parses a single-key {Label: true} object to the label (no raw JSON)', () => {
    // The exact regressions Matt saw on the listing detail page 2026-06-24.
    expect(formatMlsMultiSelect('{"Stemwall": true}')).toBe('Stemwall')
    expect(formatMlsMultiSelect('{"One": true}')).toBe('One')
  })

  it('joins the truthy labels of a multi-key object', () => {
    expect(formatMlsMultiSelect('{"Septic Tank": true, "Standard Leach Field": true}')).toBe(
      'Septic Tank, Standard Leach Field',
    )
    expect(formatMlsMultiSelect('{"Composition": true, "Membrane": true}')).toBe('Composition, Membrane')
  })

  it('keeps only the keys whose value is true (string "true" allowed)', () => {
    expect(formatMlsMultiSelect('{"Public": true, "Well": false}')).toBe('Public')
    expect(formatMlsMultiSelect('{"Public": "true", "Shared": "false"}')).toBe('Public')
  })

  it('joins an array of label strings', () => {
    expect(formatMlsMultiSelect('["Fenced", "Wooded", "Native Plants"]')).toBe('Fenced, Wooded, Native Plants')
  })

  it('passes a plain scalar string through unchanged', () => {
    expect(formatMlsMultiSelect('Frame')).toBe('Frame')
    expect(formatMlsMultiSelect('  Northeast ')).toBe('Northeast')
  })

  it('never renders raw: an object with no truthy keys or an unparseable brace returns null', () => {
    expect(formatMlsMultiSelect('{"Stemwall": false}')).toBeNull()
    expect(formatMlsMultiSelect('{not valid json')).toBeNull()
    expect(formatMlsMultiSelect('[broken')).toBeNull()
    expect(formatMlsMultiSelect('{}')).toBeNull()
    expect(formatMlsMultiSelect('[]')).toBeNull()
  })

  it('drops the privacy sentinel / empty / null', () => {
    expect(formatMlsMultiSelect('********')).toBeNull()
    expect(formatMlsMultiSelect('')).toBeNull()
    expect(formatMlsMultiSelect(null)).toBeNull()
    expect(formatMlsMultiSelect(undefined)).toBeNull()
  })
})
