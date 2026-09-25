import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3PlaceDocuments } from '@/components/site/v3/V3PlaceDocuments'
import {
  placeDocumentsLead,
  summarizePlaceDocuments,
  type PlaceDocument,
  type PlaceDocumentKind,
} from '@/lib/data/places/place-document-view'

/**
 * The documents section's note and the neighborhood FAQ's CC&Rs answer open
 * with one count. Found live 2026-09-25: Mountain View's page read "4 recorded
 * documents for Mountain View — 2 declarations and 1 recorded amendment". The
 * fourth document, the bylaws, was never named, so the parts did not add up to
 * the count (CLAUDE.md §0), and the em dash broke Matt's 2026-09-20 lock.
 */

function doc(id: string, kind: PlaceDocumentKind, over: Partial<PlaceDocument> = {}): PlaceDocument {
  return {
    id,
    publishedName: 'MOUNTAIN VIEW',
    kind,
    recordingRef: `327-${id}`,
    recordingType: 'book-page',
    publisher: null,
    documentDate: null,
    book: 327,
    page: 2523,
    instrumentNumber: null,
    recordingYear: 1978,
    county: 'Deschutes',
    sourceIndexUrl: 'https://example.com/index',
    sourceLabel: 'Deschutes County Title',
    url: `https://example.com/${id}.pdf`,
    fileBytes: 1000,
    pageCount: 3,
    ...over,
  }
}

// Mountain View's four, by kind: two declarations, an amendment, the bylaws.
const MOUNTAIN_VIEW = [doc('a', 'ccr'), doc('b', 'ccr'), doc('c', 'amendment'), doc('d', 'bylaws')]

function lead(documents: PlaceDocument[], place = 'Mountain View'): string {
  const summary = summarizePlaceDocuments(documents)
  if (!summary) throw new Error('expected a summary')
  return placeDocumentsLead(summary, place)
}

describe('placeDocumentsLead', () => {
  it('names every kind, so the parts add up to the count', () => {
    expect(lead(MOUNTAIN_VIEW)).toBe(
      '4 recorded documents for Mountain View: 2 declarations, an amendment, and the bylaws',
    )
  })

  it('words each kind by its count', () => {
    const every = [
      doc('a', 'ccr'),
      doc('b', 'amendment'),
      doc('c', 'amendment'),
      doc('d', 'bylaws'),
      doc('e', 'bylaws'),
      doc('f', 'articles'),
      doc('g', 'design_guidelines'),
      doc('h', 'rules'),
    ]
    expect(lead(every)).toBe(
      '8 recorded documents for Mountain View: the declaration, 2 amendments, 2 sets of bylaws, ' +
        'the articles of incorporation, the design guidelines, and the rules and regulations',
    )
  })

  it('needs no breakdown for one kind or one document', () => {
    expect(lead([doc('a', 'ccr'), doc('b', 'ccr')])).toBe('2 recorded documents for Mountain View')
    expect(lead([doc('a', 'bylaws')])).toBe('1 recorded document for Mountain View')
  })

  it('does not call an association copy recorded', () => {
    const published = doc('p', 'rules', {
      recordingType: 'association-published',
      publisher: 'Mountain View HOA',
      book: null,
      page: null,
    })
    expect(lead([doc('a', 'ccr'), published])).toBe(
      '2 documents for Mountain View: the declaration and the rules and regulations',
    )
  })

  it('drops the breakdown rather than name parts that fall short of the count', () => {
    const unknown = doc('x', 'plat' as PlaceDocumentKind)
    expect(lead([doc('a', 'ccr'), doc('b', 'amendment'), unknown])).toBe('3 recorded documents for Mountain View')
  })
})

describe('V3PlaceDocuments note', () => {
  it('opens with the same count, with no em dash', () => {
    const html = renderToStaticMarkup(
      createElement(V3PlaceDocuments, { displayName: 'Mountain View', documents: MOUNTAIN_VIEW }),
    )
    expect(html).toContain(
      '4 recorded documents for Mountain View: 2 declarations, an amendment, and the bylaws. Read them here.',
    )
    expect(html).not.toContain('—')
  })
})
