import { describe, expect, it } from 'vitest'
import {
  demoteImplausibleSignatureFields,
  fillStackedUnderlineRun,
  promoteInitialsBoxes,
  promoteLinedFormFields,
  stackedUnderlineRuns,
  wrapTextToWidth,
} from './lined-signature-fields'
import type { MappedField } from './skyslope-field-map'

function field(partial: Partial<MappedField> & Pick<MappedField, 'label' | 'x' | 'y' | 'w' | 'h'>): MappedField {
  return {
    type: 'text',
    page: 1,
    dataRef: partial.label,
    signerRole: null,
    optional: false,
    ...partial,
  }
}

describe('promoteLinedFormFields', () => {
  it('sits the overlay on the printed Delivering/Receiving lines, not a dumped stack', () => {
    const map = [
      field({ label: 'Delivering Party', x: 0.184, y: 0.537, w: 0.451, h: 0.022 }),
      field({ label: 'DateTime', x: 0.702, y: 0.543, w: 0.188, h: 0.016 }),
      field({ label: 'Print', x: 0.184, y: 0.558, w: 0.45, h: 0.016 }),
      field({ label: 'Receiving Party', x: 0.183, y: 0.708, w: 0.451, h: 0.022 }),
      field({ label: 'DateTime_5', x: 0.701, y: 0.713, w: 0.188, h: 0.016 }),
      field({ label: 'Print_5', x: 0.184, y: 0.728, w: 0.45, h: 0.016 }),
      field({ label: 'Buyers', x: 0.141, y: 0.126, w: 0.799, h: 0.016 }),
    ]
    const out = promoteLinedFormFields(map)
    const delivering = out.find((f) => f.label === 'Delivering Party')
    const receiving = out.find((f) => f.label === 'Receiving Party')
    expect(delivering).toMatchObject({ type: 'signature', signerRole: 'seller', x: 0.184, y: 0.537, w: 0.451 })
    expect(receiving).toMatchObject({ type: 'signature', signerRole: 'buyer', x: 0.183, y: 0.708 })
    expect(out.find((f) => f.label === 'DateTime')).toMatchObject({ type: 'date_signed', signerRole: 'seller' })
    expect(out.find((f) => f.label === 'Print')).toMatchObject({ type: 'full_name', signerRole: 'seller' })
    expect(out.find((f) => f.label === 'DateTime_5')).toMatchObject({ type: 'date_signed', signerRole: 'buyer' })
    expect(out.find((f) => f.label === 'Print_5')).toMatchObject({ type: 'full_name', signerRole: 'buyer' })
    expect(out.find((f) => f.label === 'Buyers')?.type).toBe('text')
  })

  it('keeps extra Delivering/Receiving lines optional so one party is not asked to sign four times', () => {
    const map = [
      field({ label: 'Delivering Party', x: 0.184, y: 0.537, w: 0.451, h: 0.022 }),
      field({ label: 'Delivering Party_2', x: 0.184, y: 0.575, w: 0.451, h: 0.022 }),
      field({ label: 'Receiving Party', x: 0.183, y: 0.708, w: 0.451, h: 0.022 }),
      field({ label: 'Receiving Party_2', x: 0.183, y: 0.746, w: 0.451, h: 0.022 }),
    ]
    const out = promoteLinedFormFields(map)
    expect(out.find((f) => f.label === 'Delivering Party')).toMatchObject({ type: 'signature', optional: false })
    expect(out.find((f) => f.label === 'Delivering Party_2')).toMatchObject({ type: 'signature', optional: true })
    expect(out.find((f) => f.label === 'Receiving Party')).toMatchObject({ type: 'signature', optional: false })
    expect(out.find((f) => f.label === 'Receiving Party_2')).toMatchObject({ type: 'signature', optional: true })
  })

  it('leaves the 059 document-list underlines as text, not signatures', () => {
    const map = [8, 9, 10, 11].map((n, i) =>
      field({ label: String(n), x: 0.088, y: 0.251 + i * 0.015, w: 0.763, h: 0.016 }),
    )
    const out = promoteLinedFormFields(map)
    expect(out.every((f) => f.type === 'text')).toBe(true)
  })

  it('keeps 001 buyer and seller blocks on their printed lines', () => {
    const map = [
      field({ label: 'Buyer_4', page: 15, x: 0.126, y: 0.309, w: 0.509, h: 0.022 }),
      field({ label: 'Date_27', page: 15, x: 0.702, y: 0.314, w: 0.188, h: 0.016 }),
      field({ label: 'Print_5', page: 15, x: 0.126, y: 0.329, w: 0.509, h: 0.016 }),
      field({ label: 'Seller_5', page: 15, x: 0.126, y: 0.737, w: 0.509, h: 0.022 }),
      field({ label: 'Date_33', page: 15, x: 0.702, y: 0.742, w: 0.188, h: 0.016 }),
      field({ label: 'Print_9', page: 15, x: 0.126, y: 0.757, w: 0.509, h: 0.016 }),
    ]
    const out = promoteLinedFormFields(map)
    expect(out.find((f) => f.label === 'Buyer_4')).toMatchObject({ type: 'signature', signerRole: 'buyer', y: 0.309 })
    expect(out.find((f) => f.label === 'Seller_5')).toMatchObject({ type: 'signature', signerRole: 'seller', y: 0.737 })
  })
})

describe('wrapTextToWidth', () => {
  const measure = (s: string) => s.length
  it('keeps a short line intact', () => {
    expect(wrapTextToWidth('Inspection waived', 40, measure)).toEqual(['Inspection waived'])
  })
  it('wraps contingency language onto the next line instead of running past the box', () => {
    const lines = wrapTextToWidth('Buyer removes the inspection contingency in section 8 of the sale agreement.', 24, measure)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((l) => l.length <= 24)).toBe(true)
    expect(lines.join(' ')).toBe('Buyer removes the inspection contingency in section 8 of the sale agreement.')
  })
  it('is empty for blank input', () => {
    expect(wrapTextToWidth('   ', 10, measure)).toEqual([])
  })
})

describe('stacked underlines', () => {
  it('wraps a long delivery clause onto consecutive printed lines', () => {
    const run = [8, 9, 10, 11].map((n, i) =>
      field({ label: String(n), x: 0.088, y: 0.251 + i * 0.015, w: 0.763, h: 0.016 }),
    )
    const filled = fillStackedUnderlineRun(
      run,
      "Seller delivers to Buyer the following documents previously executed on this file: OREF 020 Seller's Property Disclosure Statement; OREF 043 Electronic Funds Transfer Advisory; OREF 015 Exclusive Right to Sell Listing Agreement; and OREF 042 Initial Agency Disclosure Pamphlet.",
      (s) => s.length,
      72,
    )
    expect(filled.filter((r) => r.text).length).toBeGreaterThan(1)
    expect(filled.every((r) => r.text.length <= 72)).toBe(true)
    expect(filled.map((r) => r.field.y)).toEqual(run.map((f) => f.y))
    expect(stackedUnderlineRuns(run)).toHaveLength(1)
  })
})

describe('promoteInitialsBoxes', () => {
  it('puts 060 buyer initials on the left cluster and seller on the right', () => {
    const xs = [0.124, 0.193, 0.262, 0.331, 0.668, 0.737, 0.806, 0.875]
    const map = xs.map((x, i) => field({ label: `i${i}`, x, y: 0.897, w: 0.051, h: 0.016 }))
    const out = promoteInitialsBoxes(map)
    expect(out.filter((f) => f.signerRole === 'buyer' && f.type === 'initials')).toHaveLength(4)
    expect(out.filter((f) => f.signerRole === 'seller' && f.type === 'initials')).toHaveLength(4)
    expect(out.find((f) => f.x === 0.124)).toMatchObject({ type: 'initials', signerRole: 'buyer', optional: false })
    expect(out.find((f) => f.x === 0.193)).toMatchObject({ optional: true })
    expect(out.find((f) => f.x === 0.668)).toMatchObject({ type: 'initials', signerRole: 'seller', optional: false })
  })
})

describe('promoteInitialsBoxes from the printed labels', () => {
  const xs = [0.127, 0.197, 0.266, 0.334, 0.672, 0.741, 0.81, 0.879]
  const boxes = (only?: number[]) =>
    xs.filter((_, i) => !only || only.includes(i)).map((x, i) => field({ label: `Text213.${i}`, x, y: 0.901, w: 0.051, h: 0.0164, page: 2 }))
  const label = (str: string, x: number) => ({ str, x, y: 0.915, w: str.length * 0.0064 })
  const blanks = '________ / ________ / ________ / ________'

  it('puts each cluster on the principal printed before it, whatever order the form lists its signers (020)', () => {
    const page = [label(`Buyer Initials ${blanks}`, 0.046), label('Seller In', 0.591), label(`itials ${blanks}`, 0.639)]
    const out = promoteInitialsBoxes(boxes(), ['seller', 'buyer'], [[], page])
    expect(out.slice(0, 4).map((f) => f.signerRole)).toEqual(['buyer', 'buyer', 'buyer', 'buyer'])
    expect(out.slice(4).map((f) => f.signerRole)).toEqual(['seller', 'seller', 'seller', 'seller'])
    // The nth box is the nth signer's; the first of each is required.
    expect(out.slice(4).map((f) => [f.signerIndex, f.optional])).toEqual([
      [0, false],
      [1, true],
      [2, true],
      [3, true],
    ])
  })

  it('reads Seller on the left and Buyer on the right when a form prints them that way', () => {
    const page = [label(`Seller Initials ${blanks}`, 0.046), label(`Buyer Initials ${blanks}`, 0.591)]
    const out = promoteInitialsBoxes(boxes(), ['buyer', 'seller'], [[], page])
    expect(out[0]).toMatchObject({ type: 'initials', signerRole: 'seller' })
    expect(out[7]).toMatchObject({ type: 'initials', signerRole: 'buyer' })
  })

  it('gives all four boxes to the one cluster a page prints (the 020’s last page: Seller Initials alone)', () => {
    const page = [label(`Seller Initials ${blanks}`, 0.591)]
    const out = promoteInitialsBoxes(boxes([4, 5, 6, 7]), ['buyer', 'seller'], [[], page])
    expect(out.map((f) => f.signerRole)).toEqual(['seller', 'seller', 'seller', 'seller'])
  })

  it('leaves initials required only if an option is chosen optional (015 "required if option [a] is selected")', () => {
    const page = [{ str: 'Seller(s) Initials ( required if option [a] is selected ) ___ / ___ / ___ / ___', x: 0.38, y: 0.915, w: 0.56 }]
    const out = promoteInitialsBoxes(boxes([4, 5, 6, 7]), ['seller'], [[], page])
    // conditional: the envelope never makes them required, whoever they go to.
    expect(out.every((f) => f.type === 'initials' && f.signerRole === 'seller' && f.optional && f.conditional)).toBe(true)
  })

  it('splits a compact footer where a new label is printed between two boxes', () => {
    const at = (x: number, i: number) => field({ label: `c${i}`, x, y: 0.901, w: 0.04, h: 0.0164, page: 2 })
    const map = [0.2, 0.26, 0.44, 0.5].map(at)
    const page = [label('Buyer Initials ___ / ___', 0.1), label('Seller Initials ___ / ___', 0.335)]
    const out = promoteInitialsBoxes(map, ['buyer', 'seller'], [[], page])
    expect(out.map((f) => f.signerRole)).toEqual(['buyer', 'buyer', 'seller', 'seller'])
  })

  it('names a lone initials box from its printed label ("By Seller (initials)")', () => {
    const box = field({ type: 'initials', label: 'Initials1', x: 0.35, y: 0.474, w: 0.05, h: 0.016 })
    const out = promoteInitialsBoxes([box], ['buyer', 'seller'], [[{ str: 'By Seller (initials)', x: 0.2, y: 0.489, w: 0.14 }]])
    expect(out[0]).toMatchObject({ type: 'initials', signerRole: 'seller' })
  })
})

describe('demoteImplausibleSignatureFields', () => {
  it('turns a tiny “signing below” pages-column widget back into text', () => {
    const map = [
      field({
        type: 'signature',
        label:
          'DELIVERY AND RECEIPT By signing below the delivering Party represents that the abovelisted items are being delivered to the receiving Party',
        x: 0.865,
        y: 0.463,
        w: 0.073,
        h: 0.016,
      }),
    ]
    const out = demoteImplausibleSignatureFields(map)
    expect(out[0]?.type).toBe('text')
  })
})

describe('promoteInitialsBoxes on a form with one principal', () => {
  it('gives the whole initials row to the seller on a listing form', () => {
    // OREF 015 has no buyer. Splitting the row buyer-left / seller-right put 19
    // required initials on a signer the envelope does not have, and every
    // listing packet refused to send.
    const xs = [0.124, 0.193, 0.262, 0.331, 0.668, 0.737, 0.806, 0.875]
    const map = xs.map((x, i) => field({ label: `i${i}`, x, y: 0.897, w: 0.051, h: 0.016 }))
    const out = promoteInitialsBoxes(map, ['seller'])
    expect(out.filter((f) => f.type === 'initials')).toHaveLength(8)
    expect(out.filter((f) => f.signerRole === 'seller')).toHaveLength(8)
    expect(out.filter((f) => f.signerRole === 'buyer')).toHaveLength(0)
  })

  it('still splits the row when both principals sign', () => {
    const xs = [0.124, 0.193, 0.262, 0.331, 0.668, 0.737, 0.806, 0.875]
    const map = xs.map((x, i) => field({ label: `i${i}`, x, y: 0.897, w: 0.051, h: 0.016 }))
    const out = promoteInitialsBoxes(map, ['buyer', 'seller'])
    expect(out.filter((f) => f.signerRole === 'buyer')).toHaveLength(4)
    expect(out.filter((f) => f.signerRole === 'seller')).toHaveLength(4)
  })
})

describe('labelSignatureRowsFromPage (who signs an unnamed line, from the printed page)', () => {
  const line = (y: number, dataRef: string) => ({ type: 'text' as const, page: 1, x: 0.126, y, w: 0.508, h: 0.021, dataRef, signerRole: null, optional: false, label: dataRef })
  const date = (y: number, dataRef: string) => ({ type: 'text' as const, page: 1, x: 0.72, y: y + 0.004, w: 0.18, h: 0.016, dataRef, signerRole: null, optional: false, label: dataRef })
  const word = (str: string, y: number) => ({ str, x: 0.088, y, w: 0.034 })

  it('reads Buyer and Seller beside the lines, and gives the nth line to the nth signer', async () => {
    const { labelSignatureRowsFromPage, promoteLinedFormFields } = await import('./lined-signature-fields')
    const map = [line(0.549, 'Text8'), date(0.549, 'Text30'), line(0.587, 'Text10'), line(0.716, 'Text16'), date(0.716, 'Text34')]
    const page = [word('26', 0.569), word('Buyer', 0.569), word('Buyer', 0.607), word('Seller', 0.736)]
    const out = promoteLinedFormFields(labelSignatureRowsFromPage(map, [page]))
    const sig = (ref: string) => out.find((f) => f.dataRef === ref)!
    expect(sig('Text8')).toMatchObject({ type: 'signature', signerRole: 'buyer', signerIndex: 0 })
    expect(sig('Text10')).toMatchObject({ type: 'signature', signerRole: 'buyer', signerIndex: 1 })
    expect(sig('Text16')).toMatchObject({ type: 'signature', signerRole: 'seller', signerIndex: 0 })
    // The row's date goes with its line.
    expect(sig('Text30')).toMatchObject({ type: 'date_signed', signerRole: 'buyer', signerIndex: 0 })
    expect(sig('Text34')).toMatchObject({ type: 'date_signed', signerRole: 'seller', signerIndex: 0 })
  })

  it('names nobody when the page text cannot be read (a font with no Unicode map)', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    // What pdfjs returns for "Buyer" and "Seller" on the OREF 002 01/2026 blank.
    const page = [word('R A = ? 4', 0.569), word('\u0000 ? G G ? 4', 0.736)]
    const out = labelSignatureRowsFromPage([line(0.549, 'Text8'), line(0.716, 'Text16')], [page])
    expect(out.every((f) => f.signerRole === null && f.signerIndex === undefined)).toBe(true)
  })

  it('takes the printed word over the widget name (the 071 names its Buyer rows "Seller", "SWeller")', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    const out = labelSignatureRowsFromPage([line(0.549, 'Seller_5')], [[word('Buyer', 0.569)]])
    expect(out[0]).toMatchObject({ signerRole: 'buyer', signerIndex: 0 })
  })

  it('keeps the widget name when the printed row names nobody', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    const out = labelSignatureRowsFromPage([line(0.549, 'Seller_5')], [[word('R A = ? 4', 0.569)]])
    expect(out[0]).toMatchObject({ label: 'Seller_5', signerRole: null, signerIndex: 0 })
  })

  it('reads a label printed in one run with its underline ("Buyer ______ Date/Time ___", the 020 and 071)', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    const row = (str: string, y: number) => ({ str, x: 0.088, y, w: 0.83 })
    const underline = '_'.repeat(35)
    const out = labelSignatureRowsFromPage(
      [line(0.766, 'Text202'), line(0.804, 'Text204')],
      [[row(`Buyer ${underline} Date / Time ${'_'.repeat(22)}`, 0.7875), row(`Seller ${underline} Date / Time ${'_'.repeat(22)}`, 0.8255)]],
    )
    expect(out.map((f) => f.signerRole)).toEqual(['buyer', 'seller'])
  })

  it('counts signers again at each block, so a second Seller block starts with the first seller', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    // OREF 020: a Seller block on page 1 (claiming an exclusion) and another on page 7.
    const onPage = (page: number, y: number, ref: string) => ({ ...line(y, ref), page })
    const map = [onPage(1, 0.594, 'Text186'), onPage(1, 0.625, 'Text188'), onPage(7, 0.432, 'Text247'), onPage(7, 0.469, 'Text249')]
    const seller = (y: number) => word('Seller', y + 0.021)
    const out = labelSignatureRowsFromPage(map, [[seller(0.594), seller(0.625)], [], [], [], [], [], [seller(0.432), seller(0.469)]])
    expect(out.map((f) => [f.signerRole, f.signerIndex])).toEqual([
      ['seller', 0],
      ['seller', 1],
      ['seller', 0],
      ['seller', 1],
    ])
  })

  it('reads "Buyer’s Agent" split into pieces as the buyer’s agent (the 021)', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    const pieces = [
      { str: 'Buyer', x: 0.088, y: 0.177, w: 0.03 },
      { str: '\u2019', x: 0.118, y: 0.177, w: 0.004 },
      { str: 's Agent', x: 0.125, y: 0.177, w: 0.04 },
      { str: '1', x: 0.17, y: 0.177, w: 0.005 },
    ]
    const out = labelSignatureRowsFromPage([{ ...line(0.157, 'Buyers Agent 1'), x: 0.18 }], [pieces])
    expect(out[0]).toMatchObject({ signerRole: 'buyer_agent' })
  })

  it('gives a "Client" line to the form’s one principal, and to nobody on a form both principals sign', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    const page = [word('Client', 0.569)]
    expect(labelSignatureRowsFromPage([line(0.549, 'Text8')], [page], ['buyer', 'buyer_agent'])[0]).toMatchObject({ signerRole: 'buyer' })
    expect(labelSignatureRowsFromPage([line(0.549, 'Text8')], [page], ['buyer', 'seller'])[0]!.signerRole).toBeNull()
  })
})

describe('labelSignatureRowsFromPage (review fixes, 2026-09-30)', () => {
  const box = (y: number, ref: string, x = 0.126, w = 0.508) => ({ type: 'text' as const, page: 1, x, y, w, h: 0.021, dataRef: ref, signerRole: null, optional: false, label: ref })
  const word = (str: string, y: number, x = 0.088) => ({ str, x, y, w: str.length * 0.0064 })

  it('counts rows that alternate Buyer, Seller, Buyer, Seller as one block', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    const ys = [0.5, 0.54, 0.58, 0.62]
    const who = ['Buyer', 'Seller', 'Buyer', 'Seller']
    const out = labelSignatureRowsFromPage(ys.map((y, i) => box(y, `Text${i}`)), [ys.map((y, i) => word(who[i]!, y + 0.02))])
    expect(out.map((f) => [f.signerRole, f.signerIndex])).toEqual([
      ['buyer', 0],
      ['seller', 0],
      ['buyer', 1],
      ['seller', 1],
    ])
  })

  it('reads the OR forms’ two-column rows, each line with its own Dated blank (2.2 General Addendum)', async () => {
    const { labelSignatureRowsFromPage, promoteLinedFormFields } = await import('./lined-signature-fields')
    const y = 0.8323
    const map = [
      { ...box(y, 'Buyer_5', 0.105, 0.233), h: 0.0218 },
      { ...box(y + 0.0054, 'Dated', 0.383, 0.071), h: 0.0164 },
      { ...box(y, 'Seller_5', 0.53, 0.237), h: 0.0218 },
      { ...box(y + 0.0054, 'Dated_2', 0.811, 0.071), h: 0.0164 },
    ]
    const row = [word('Buyer', 0.853, 0.06), word(':', 0.853, 0.1), word('Date', 0.853, 0.34), word('d:', 0.853, 0.37), word('Seller', 0.853, 0.49), word(':', 0.853, 0.52)]
    const out = promoteLinedFormFields(labelSignatureRowsFromPage(map, [row]))
    const by = (ref: string) => out.find((f) => f.dataRef === ref)!
    expect(by('Buyer_5')).toMatchObject({ type: 'signature', signerRole: 'buyer', signerIndex: 0 })
    expect(by('Dated')).toMatchObject({ type: 'date_signed', signerRole: 'buyer' })
    expect(by('Seller_5')).toMatchObject({ type: 'signature', signerRole: 'seller', signerIndex: 0 })
    expect(by('Dated_2')).toMatchObject({ type: 'date_signed', signerRole: 'seller' })
  })

  it('gives a Broker or Agent line to the form’s one agent (9.4 "Agent:", 9.3 "Broker [signing for Broker ...]:")', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    const agentRow = labelSignatureRowsFromPage([box(0.647, 'Agent', 0.106, 0.476)], [[word('133', 0.667, 0.02), word('Agent :', 0.667, 0.06)]], ['buyer', 'buyer_agent'])
    expect(agentRow[0]).toMatchObject({ signerRole: 'buyer_agent' })
    const right = { ...box(0.7472, 'Principal Broker_2_0_0_0', 0.552, 0.375), h: 0.0218 }
    const brokerRow = labelSignatureRowsFromPage([right], [[word('Broker [signing for Broker, individually, and on behalf of Principal Broker] :', 0.767, 0.06)]], ['seller', 'listing_agent'])
    expect(brokerRow[0]).toMatchObject({ type: 'signature', signerRole: 'listing_agent' })
    // Two agents on the form: nobody can say whose.
    const both = labelSignatureRowsFromPage([box(0.647, 'Agent', 0.106, 0.476)], [[word('Agent :', 0.667, 0.06)]], ['buyer', 'seller', 'buyer_agent', 'listing_agent'])
    expect(both[0]!.signerRole).toBeNull()
  })

  it('leaves a "Client" line alone when the form’s signers are not known', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    expect(labelSignatureRowsFromPage([box(0.549, 'Text8')], [[word('Client', 0.569)]], [])[0]!.signerRole).toBeNull()
  })

  it('leaves a box the last-page stack placed as it is', async () => {
    const { labelSignatureRowsFromPage } = await import('./lined-signature-fields')
    const stacked = { ...box(0.78, 'BuyerSignature', 0.12, 0.38), type: 'signature' as const, h: 0.045, signerRole: 'buyer' as const, fromStack: true }
    const out = labelSignatureRowsFromPage([stacked], [[word('Seller', 0.82)]])
    expect(out[0]).toMatchObject({ signerRole: 'buyer' })
    expect(out[0]!.signerIndex).toBeUndefined()
  })
})

describe('printedRole (who a printed label names)', () => {
  it.each([
    ['Buyer', 'buyer'],
    ['Seller Initials', 'seller'],
    ['Buyer \u2019 s Agent 1', 'buyer_agent'],
    ["Seller's Agent", 'listing_agent'],
    ['Seller(s) Initials (required if option [a] is selected)', 'seller'],
    ['Grantor (Seller)', 'seller'],
    ['Your (Seller) Signature(s):', 'seller'],
    ['Buyer Seller', null],
    ['BUYER HEREBY ACKNOWLEDGES RECEIPT OF A COPY OF THIS SELLER', null],
    ['R A = ? 4', null],
  ])('%s -> %s', async (label, role) => {
    const { printedRole } = await import('./lined-signature-fields')
    expect(printedRole(label)).toBe(role)
  })
})
