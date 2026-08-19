import { describe, it, expect } from 'vitest'
import { noteToText } from '@/lib/crm/note-text'

describe('noteToText', () => {
  it('turns CRM-era <br /> markup into real newlines (the measured defect)', () => {
    expect(noteToText('Notes:<br />\nProperty Details:<br />\n- Beds: 3<br />')).toBe(
      'Notes:\n\nProperty Details:\n\n- Beds: 3'
    )
  })

  it('leaves plain prose byte-identical (never edits content)', () => {
    const plain = 'Called Michael. Wants to list in spring — 3/2 in Redmond, needs a roof quote.'
    expect(noteToText(plain)).toBe(plain)
  })

  it('preserves prose while unwrapping block tags', () => {
    expect(noteToText('<p>First para</p><p>Second para</p>')).toBe('First para\nSecond para')
  })

  it('decodes the standard entities, and does not double-decode &amp;lt;', () => {
    expect(noteToText('Smith &amp; Sons said &quot;yes&quot;')).toBe('Smith & Sons said "yes"')
    expect(noteToText('literal &amp;lt; stays')).toBe('literal &lt; stays')
  })

  it('keeps a bare < that is not markup', () => {
    expect(noteToText('offer < asking')).toBe('offer < asking')
  })

  it('handles null/empty', () => {
    expect(noteToText(null)).toBe('')
    expect(noteToText(undefined)).toBe('')
    expect(noteToText('')).toBe('')
  })

  it('collapses the blank-line runs unwrapping leaves behind', () => {
    expect(noteToText('a<br /><br /><br />b')).toBe('a\n\nb')
  })
})
