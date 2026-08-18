import { describe, expect, it } from 'vitest'
import { parseOwnerNotes, renderOwnerNotesPrintHtml, renderOwnerNotesSceneHtml } from '@/lib/cma/owner-notes'

describe('parseOwnerNotes', () => {
  it('keeps structured items and drops blanks', () => {
    expect(
      parseOwnerNotes(null, [
        'Interior and exterior repainted',
        '',
        'New solid surface countertops',
        'Bathroom remodel',
      ]),
    ).toEqual([
      'Interior and exterior repainted',
      'New solid surface countertops',
      'Bathroom remodel',
    ])
  })

  it('splits a broker paste on lines and bullets', () => {
    const text = `They've had both the interior and exterior repainted
- new solid surface countertops
• bathroom remodel`
    expect(parseOwnerNotes(text)).toEqual([
      "They've had both the interior and exterior repainted",
      'new solid surface countertops',
      'bathroom remodel',
    ])
  })

  it('returns empty when the owner said nothing', () => {
    expect(parseOwnerNotes(null)).toEqual([])
    expect(parseOwnerNotes('   ')).toEqual([])
  })
})

describe('owner notes HTML', () => {
  const notes = [
    'Interior and exterior repainted',
    'New solid surface countertops',
    'Bathroom remodel',
  ]

  it('prints a seller chapter from the reported work', () => {
    const html = renderOwnerNotesPrintHtml(notes)
    expect(html).toContain('What you have done to this house')
    expect(html).toContain('Interior and exterior repainted')
    expect(html).toContain('Bathroom remodel')
    expect(html).toContain('We have not inspected this work')
  })

  it('renders the same chapter on the web view', () => {
    const html = renderOwnerNotesSceneHtml(notes)
    expect(html).toContain('id="owner-notes"')
    expect(html).toContain('New solid surface countertops')
  })

  it('omits the chapter when there are no notes', () => {
    expect(renderOwnerNotesPrintHtml([])).toBe('')
    expect(renderOwnerNotesSceneHtml([])).toBe('')
  })
})
