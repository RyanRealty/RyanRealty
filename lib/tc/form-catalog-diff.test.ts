import { describe, expect, it } from 'vitest'
import {
  catalogBlanksToPull,
  diffLibraryCatalog,
  matchHeldForm,
  normalizeFormNumber,
  parseCatalogPayload,
  parseFormNumber,
  parseVersionLabel,
} from './form-catalog-diff'

describe('parseFormNumber', () => {
  it('reads OREF prefixes and a leading three-digit number', () => {
    expect(parseFormNumber('OREF-001 Residential Sale Agreement')).toBe('001')
    expect(parseFormNumber('OREF 022A Repair Addendum')).toBe('022A')
    expect(parseFormNumber('001 Residential Real Estate Sale Agreement (01/2026)')).toBe('001')
  })
  it('reads a trailing OREF number from the live SkySlope name', () => {
    expect(parseFormNumber('Residential Real Estate Sale Agreement - 001 OREF')).toBe('001')
    expect(parseFormNumber('Things to Know Before Signing - 000A OREF')).toBe('000A')
    expect(parseFormNumber('Addendum to Sale Agreement 2 page - 002A OREF')).toBe('002A')
    expect(parseFormNumber('Buyers Repair Addendum - 022A (1) OREF')).toBe('022A')
  })
  it('reads Oregon Realtors dotted numbers', () => {
    expect(parseFormNumber('1.1 Oregon Residential Real Estate Purchase And Sale Agreement - OR')).toBe(
      '1.1',
    )
    expect(parseFormNumber('10.4 Initial Agency Disclosure Pamphlet (Buyer) - OR')).toBe('10.4')
    expect(parseFormNumber('1.1A Seller Side Purchase and Sale Agreement - OR')).toBe('1.1A')
  })
  it('does not invent a number from a mid-title year', () => {
    expect(parseFormNumber('Lead-Based Paint Disclosure')).toBeNull()
    expect(parseFormNumber('ORE Residential Input - ODS')).toBeNull()
  })
})

describe('parseVersionLabel', () => {
  it('reads a month/year stamp and a Rev label', () => {
    expect(parseVersionLabel('001 RSA (01/2026)')).toBe('01/2026')
    expect(parseVersionLabel('Listing Agreement Rev 10.4')).toBe('10.4')
  })
  it('reads a YYYY-MM stamp used on older ODS samples', () => {
    expect(parseVersionLabel('ODS Residential Input Form 2024-05')).toBe('2024-05')
  })
})

describe('normalizeFormNumber', () => {
  it('strips an OREF prefix and uppercases', () => {
    expect(normalizeFormNumber('oref-001')).toBe('001')
    expect(normalizeFormNumber(' 022a ')).toBe('022A')
    expect(normalizeFormNumber(null)).toBeNull()
  })
})

describe('matchHeldForm', () => {
  const held = [
    { id: 'a', sourceFormId: 'form-1', sourceVersionId: 'v1', formNumber: '001', name: 'RSA' },
    { id: 'b', sourceFormId: null, sourceVersionId: null, formNumber: '015', name: 'Listing sample' },
  ]
  it('prefers source form id over form number', () => {
    const taken = new Set<string>()
    const match = matchHeldForm(
      { sourceFormId: 'form-1', sourceVersionId: 'v2', name: '015 Something', formNumber: '015' },
      held,
      taken,
    )
    expect(match?.id).toBe('a')
  })
  it('falls back to form number for samples that have no source id', () => {
    const taken = new Set<string>()
    const match = matchHeldForm(
      { sourceFormId: 'ss-015', sourceVersionId: 'v9', name: '015 Listing Agreement', formNumber: '015' },
      held,
      taken,
    )
    expect(match?.id).toBe('b')
  })
  it('skips already-taken held rows', () => {
    const taken = new Set(['a'])
    const match = matchHeldForm(
      { sourceFormId: 'form-1', sourceVersionId: 'v2', name: '001', formNumber: '001' },
      held,
      taken,
    )
    expect(match).toBeNull()
  })
})

describe('diffLibraryCatalog', () => {
  const held = [
    { id: 'hold-001', sourceFormId: 'f-001', sourceVersionId: 'v-old', formNumber: '001', name: 'RSA sample' },
    { id: 'hold-020', sourceFormId: 'f-020', sourceVersionId: 'v-same', formNumber: '020', name: 'SPD' },
    { id: 'hold-gone', sourceFormId: 'f-gone', sourceVersionId: 'v-x', formNumber: '099', name: 'Retired at source' },
    { id: 'hold-local', sourceFormId: null, sourceVersionId: null, formNumber: null, name: 'House cover sheet' },
  ]

  it('flags updated, current, new, and retired; leaves unidentified local forms alone', () => {
    const { items, counts } = diffLibraryCatalog(
      [
        { sourceFormId: 'f-001', sourceVersionId: 'v-new', name: '001 RSA (01/2026)', formNumber: '001' },
        { sourceFormId: 'f-020', sourceVersionId: 'v-same', name: '020 SPD', formNumber: '020' },
        { sourceFormId: 'f-050', sourceVersionId: 'v-1', name: '050 Buyer Rep', formNumber: '050' },
      ],
      held,
    )
    expect(counts).toEqual({ updated: 1, current: 1, new: 1, retired: 1 })
    expect(items.find((i) => i.sourceFormId === 'f-001')?.disposition).toBe('updated')
    expect(items.find((i) => i.sourceFormId === 'f-001')?.heldFormVersionId).toBe('hold-001')
    expect(items.find((i) => i.sourceFormId === 'f-020')?.disposition).toBe('current')
    expect(items.find((i) => i.sourceFormId === 'f-050')?.disposition).toBe('new')
    expect(items.find((i) => i.sourceFormId === 'f-050')?.heldFormVersionId).toBeNull()
    expect(items.find((i) => i.sourceFormId === 'f-gone')?.disposition).toBe('retired')
    expect(items.some((i) => i.heldFormVersionId === 'hold-local')).toBe(false)
  })

  it('treats a sample matched only by form number as updated when we have no source version', () => {
    const { items } = diffLibraryCatalog(
      [{ sourceFormId: 'ss-015', sourceVersionId: 'pub-1', name: '015 Listing', formNumber: '015' }],
      [{ id: 'sample-015', sourceFormId: null, sourceVersionId: null, formNumber: '015', name: '015 Listing (SAMPLE)' }],
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.disposition).toBe('updated')
    expect(items[0]?.heldFormVersionId).toBe('sample-015')
  })

  it('dedupes a repeated source form id in the incoming list', () => {
    const { counts } = diffLibraryCatalog(
      [
        { sourceFormId: 'f-1', sourceVersionId: 'v1', name: 'A' },
        { sourceFormId: 'f-1', sourceVersionId: 'v2', name: 'A again' },
      ],
      [],
    )
    expect(counts.new).toBe(1)
  })

  it('pulls preview URLs only for updated and new forms, never current', () => {
    const incoming = [
      { sourceFormId: 'f-001', sourceVersionId: 'v-new', name: '001', previewUrl: 'https://a/1.pdf' },
      { sourceFormId: 'f-020', sourceVersionId: 'v-same', name: '020', previewUrl: 'https://a/2.pdf' },
      { sourceFormId: 'f-050', sourceVersionId: 'v-1', name: '050', previewUrl: 'https://a/3.pdf' },
    ]
    const { items } = diffLibraryCatalog(incoming, [
      { id: 'hold-001', sourceFormId: 'f-001', sourceVersionId: 'v-old', formNumber: '001', name: 'RSA' },
      { id: 'hold-020', sourceFormId: 'f-020', sourceVersionId: 'v-same', formNumber: '020', name: 'SPD' },
    ])
    const pull = catalogBlanksToPull(items, incoming)
    expect(pull.map((f) => f.sourceFormId).sort()).toEqual(['f-001', 'f-050'])
  })
})

describe('parseCatalogPayload', () => {
  it('accepts a single-library object and a libraries array', () => {
    const one = parseCatalogPayload({
      libraryCode: 'oref',
      sourceLibraryId: '1340',
      forms: [{ sourceFormId: '1', sourceVersionId: '2', name: '001 RSA' }],
    })
    expect('error' in one).toBe(false)
    if (!('error' in one)) {
      expect(one.libraries[0]?.libraryCode).toBe('OREF')
      expect(one.libraries[0]?.forms).toHaveLength(1)
    }

    const many = parseCatalogPayload({
      libraries: [
        {
          libraryCode: 'ODS',
          forms: [{ sourceFormId: '9', sourceVersionId: '8', name: 'Change' }],
        },
      ],
    })
    expect('error' in many).toBe(false)
  })

  it('keeps an https preview URL and drops anything else', () => {
    const parsed = parseCatalogPayload({
      libraryCode: 'ODS',
      forms: [
        {
          sourceFormId: '1',
          sourceVersionId: '2',
          name: 'Change',
          previewUrl: 'https://forms.example/blank.pdf',
        },
      ],
    })
    expect('error' in parsed).toBe(false)
    if (!('error' in parsed)) {
      expect(parsed.libraries[0]?.forms[0]?.previewUrl).toBe('https://forms.example/blank.pdf')
    }
  })

  it('refuses an empty forms list so we do not retire a library by accident', () => {
    const empty = parseCatalogPayload({ libraryCode: 'OREF', forms: [] })
    expect('error' in empty && empty.error).toMatch(/no published forms/)
  })

  it('rejects a missing form id or a non-object', () => {
    expect(parseCatalogPayload(null)).toMatchObject({ error: expect.stringMatching(/JSON object/) })
    const bad = parseCatalogPayload({
      libraryCode: 'OREF',
      forms: [{ sourceFormId: '', sourceVersionId: '2', name: 'X' }],
    })
    expect('error' in bad).toBe(true)
  })
})
