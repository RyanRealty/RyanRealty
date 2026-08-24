import { describe, expect, it } from 'vitest'
import { formBlankStorageBucket } from './form-blank'

describe('formBlankStorageBucket', () => {
  it('signs licensed library blanks from tc-forms', () => {
    expect(formBlankStorageBucket('ods/102935__ore-residential-input.pdf')).toBe('tc-forms')
    expect(formBlankStorageBucket('oref/117038__001.pdf')).toBe('tc-forms')
    expect(formBlankStorageBucket('or/128312__1-1.pdf')).toBe('tc-forms')
  })
  it('signs deal copies from tc-documents', () => {
    expect(formBlankStorageBucket('forms/cycle/id__slug.pdf')).toBe('tc-documents')
    expect(formBlankStorageBucket('inbox/cycle/dup-1-offer.pdf')).toBe('tc-documents')
  })
})
