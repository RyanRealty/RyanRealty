import { describe, expect, it } from 'vitest'
import { fallbackSigningStack, withFallbackSignatures,
  withNoUnsignableRequirement,
} from './fallback-signing-stack'

describe('fallbackSigningStack', () => {
  it('puts buyer, seller, and both licensee signature rows on the last page of 001', () => {
    const map = fallbackSigningStack({ pageCount: 15, formNumber: '001' })
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'buyer')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'seller')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'listing_agent')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'buyer_agent')).toBe(true)
    expect(map.every((f) => f.page === 15)).toBe(true)
  })

  it('listing 015 is seller and listing broker, not buyer', () => {
    const map = fallbackSigningStack({ pageCount: 6, formNumber: '015' })
    expect(map.some((f) => f.signerRole === 'seller')).toBe(true)
    expect(map.some((f) => f.signerRole === 'listing_agent')).toBe(true)
    expect(map.some((f) => f.signerRole === 'buyer')).toBe(false)
  })
})

describe('withFallbackSignatures', () => {
  it('uses the printed Buyer/Seller lines instead of dumping a second stack', () => {
    const map = withFallbackSignatures(
      [
        {
          type: 'text',
          page: 15,
          x: 0.126,
          y: 0.309,
          w: 0.509,
          h: 0.022,
          dataRef: 'Buyer_4',
          signerRole: null,
          optional: false,
          label: 'Buyer_4',
        },
        {
          type: 'text',
          page: 15,
          x: 0.126,
          y: 0.737,
          w: 0.509,
          h: 0.022,
          dataRef: 'Seller_5',
          signerRole: null,
          optional: false,
          label: 'Seller_5',
        },
      ],
      { pageCount: 15, formNumber: '001' },
    )
    const buyer = map.find((f) => f.label === 'Buyer_4')
    const seller = map.find((f) => f.label === 'Seller_5')
    expect(buyer).toMatchObject({ type: 'signature', y: 0.309, w: 0.509 })
    expect(seller).toMatchObject({ type: 'signature', y: 0.737, w: 0.509 })
    expect(map.filter((f) => f.type === 'signature' && f.label === 'Buyer signature')).toHaveLength(0)
  })

  it('appends last-page signatures when the AcroForm map is only text widgets', () => {
    const map = withFallbackSignatures(
      [
        {
          type: 'text',
          page: 2,
          x: 0.1,
          y: 0.2,
          w: 0.4,
          h: 0.016,
          dataRef: 'Buyer1Name',
          signerRole: 'buyer',
          optional: false,
          label: 'Buyers',
        },
      ],
      { pageCount: 15, formNumber: '001' },
    )
    expect(map.some((f) => f.type === 'text' && f.dataRef === 'Buyer1Name')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'buyer')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'seller')).toBe(true)
  })

  it('keeps 059 signatures on the printed Delivering/Receiving lines', () => {
    const map = withFallbackSignatures(
      [
        {
          type: 'text',
          page: 1,
          x: 0.184,
          y: 0.537,
          w: 0.451,
          h: 0.022,
          dataRef: 'Delivering Party',
          signerRole: null,
          optional: false,
          label: 'Delivering Party',
        },
        {
          type: 'text',
          page: 1,
          x: 0.183,
          y: 0.708,
          w: 0.451,
          h: 0.022,
          dataRef: 'Receiving Party',
          signerRole: null,
          optional: false,
          label: 'Receiving Party',
        },
        {
          type: 'signature',
          page: 1,
          x: 0.865,
          y: 0.463,
          w: 0.073,
          h: 0.016,
          dataRef:
            'DELIVERY AND RECEIPT By signing below the delivering Party represents that the abovelisted items are being delivered',
          signerRole: null,
          optional: false,
          label: 'DELIVERY AND RECEIPT By signing below the delivering Party represents that the abovelisted items are being delivered',
        },
      ],
      { pageCount: 1, formNumber: '059', documentName: 'Delivery Addendum 1 - 059 OREF' },
    )
    const dumped = map.filter((f) => f.type === 'signature' && f.y >= 0.77)
    expect(dumped).toHaveLength(0)
    expect(map.find((f) => f.label === 'Delivering Party')).toMatchObject({ type: 'signature', y: 0.537 })
    expect(map.find((f) => f.label === 'Receiving Party')).toMatchObject({ type: 'signature', y: 0.708 })
    expect(map.find((f) => f.x === 0.865)?.type).toBe('text')
  })

  it('gives a signer the form prints no line for a box only where it covers nothing', () => {
    const map = withFallbackSignatures(
      [
        {
          type: 'signature',
          page: 6,
          x: 0.1,
          y: 0.8,
          w: 0.3,
          h: 0.04,
          dataRef: 'SellerSignature',
          signerRole: 'seller',
          optional: false,
          label: 'Seller signature',
        },
      ],
      { pageCount: 6, formNumber: '015' },
    )
    expect(map.filter((f) => f.type === 'signature' && f.signerRole === 'seller')).toHaveLength(1)
    // The 015's listing broker has no line on this map: the stack's spot below the seller's is free.
    const broker = map.filter((f) => f.type === 'signature' && f.signerRole === 'listing_agent')
    expect(broker).toHaveLength(1)
    expect(broker[0]).toMatchObject({ page: 6, fromStack: true })
    expect(broker[0]!.y).toBeGreaterThanOrEqual(0.84)
  })

  it('lays no Seller box over a printed Buyer row (2.15 Release of Contingencies: buyer lines only)', () => {
    // The 2.15 blank's own widgets: Buyer_5..Buyer_8, 0.484 x 0.0191 of the page.
    const buyerLines = [0.8143, 0.831, 0.8475, 0.8641].map((y, i) => ({
      type: 'text' as const, page: 2, x: 0.105, y, w: 0.484, h: 0.0191, dataRef: `Buyer_${5 + i}`, signerRole: 'buyer' as const, optional: false, label: `Buyer_${5 + i}`,
    }))
    const map = withFallbackSignatures(buyerLines, { pageCount: 2, formNumber: '2.15', documentName: '2.15 Release of Contingencies Addendum - OR' })
    expect(map.filter((f) => f.type === 'signature').map((f) => [f.signerRole, f.signerIndex])).toEqual([
      ['buyer', 0],
      ['buyer', 1],
      ['buyer', 2],
      ['buyer', 3],
    ])
    expect(map.some((f) => f.signerRole === 'seller')).toBe(false)
  })
})

describe('withNoUnsignableRequirement', () => {
  it('stops a field nobody on the form can sign from blocking the send', () => {
    const map = [
      { type: 'signature' as const, page: 1, x: 0.1, y: 0.8, w: 0.3, h: 0.04, signerRole: 'buyer' as const, optional: false, dataRef: 'BuyerSignature', label: 'Buyer signature' },
      { type: 'initials' as const, page: 1, x: 0.1, y: 0.9, w: 0.05, h: 0.02, signerRole: 'seller' as const, optional: false, dataRef: 'SellerInitials', label: 'Seller initials' },
      { type: 'text' as const, page: 1, x: 0.1, y: 0.5, w: 0.3, h: 0.02, signerRole: null, optional: false, dataRef: 'Notes', label: 'Notes' },
    ]
    const out = withNoUnsignableRequirement(map, new Set(['seller']))
    expect(out[0]).toMatchObject({ type: 'signature', signerRole: 'buyer', optional: true })
    expect(out[1]).toMatchObject({ type: 'initials', signerRole: 'seller', optional: false })
    // Text is not a signing obligation — leave it exactly as it was.
    expect(out[2]).toMatchObject({ type: 'text', optional: false })
  })
})

describe('withFallbackSignatures on unnamed signature lines', () => {
  it('adds no fixed-position stack on top of printed lines the broker can assign', () => {
    // OREF 002 01/2026: eight signature lines named Text8..Text22, text unreadable.
    const lines = [0.549, 0.587, 0.625, 0.663, 0.716, 0.753, 0.791, 0.829].map((y, i) => ({
      type: 'text' as const, page: 1, x: 0.126, y, w: 0.508, h: 0.021, dataRef: `Text${8 + i * 2}`, signerRole: null, optional: false, label: `Text${8 + i * 2}`,
    }))
    const map = withFallbackSignatures(lines, { pageCount: 1, formNumber: '002' })
    expect(map.filter((f) => f.type === 'signature')).toHaveLength(8)
    expect(map.some((f) => f.label === 'Buyer signature' || f.label === 'Seller signature')).toBe(false)
  })
})

describe('withFallbackSignatures on the OREF 020 Seller Property Disclosure Statement', () => {
  // Geometry and words from the 01/2026 blank (tc_form_versions "Sellers Property Disclosure Statement - 020 OREF").
  const line = (page: number, y: number, ref: string) => ({
    type: 'text' as const, page, x: 0.125, y, w: 0.509, h: 0.0218, dataRef: ref, signerRole: null, optional: false, label: ref,
  })
  const box = (page: number, x: number, y: number, ref: string) => ({
    type: 'checkbox' as const, page, x, y, w: 0.014, h: 0.0107, dataRef: ref, signerRole: null, optional: false, label: ref,
  })
  const initials = (page: number, x: number, ref: string) => ({
    type: 'text' as const, page, x, y: 0.901, w: 0.051, h: 0.0164, dataRef: ref, signerRole: null, optional: false, label: ref,
  })
  const run = (str: string, x: number, y: number) => ({ str, x, y, w: str.length * 0.0064 })
  const signRow = (who: string, y: number) => run(`${who} ${'_'.repeat(35)} Date / Time ${'_'.repeat(22)}`, 0.088, y)
  const blanks = '________ / ________ / ________ / ________'
  const map = [
    line(1, 0.5944, 'Text186'),
    line(1, 0.7687, 'Text202'),
    box(2, 0.707, 0.6314, 'Check Box291'),
    box(2, 0.76, 0.6315, 'Check Box292'),
    box(2, 0.808, 0.6315, 'Check Box293'),
    { type: 'text' as const, page: 2, x: 0.3, y: 0.7, w: 0.5, h: 0.0164, dataRef: 'Text212', signerRole: null, optional: false, label: 'Text212' },
    ...[0.127, 0.197, 0.266, 0.334].map((x, i) => initials(2, x, `Text213.${i}`)),
    ...[0.672, 0.741, 0.81, 0.879].map((x, i) => initials(2, x, `Text214.${i}`)),
    line(7, 0.4315, 'Text247'),
    line(7, 0.4694, 'Text249'),
    line(8, 0.1929, 'Text262'),
    // Line 230, "Total number of pages attached ... (complete even if zero) ____".
    { type: 'text' as const, page: 7, x: 0.7376, y: 0.3991, w: 0.0438, h: 0.0164, dataRef: 'Text246', signerRole: null, optional: false, label: 'Text246' },
    // A seller answer box on page 7 with no such instruction.
    { type: 'text' as const, page: 7, x: 0.3, y: 0.3, w: 0.4, h: 0.0164, dataRef: 'Text240', signerRole: null, optional: false, label: 'Text240' },
  ]
  const pages = [
    [signRow('Seller', 0.615), signRow('Buyer', 0.7875)],
    [
      run('A. Do you have legal authority to sell the Property? ..........', 0.104, 0.64),
      run('Yes', 0.726, 0.64),
      run('No', 0.781, 0.64),
      run('Unknown', 0.827, 0.64),
      run(`Buyer Initials ${blanks}`, 0.046, 0.915),
      run(`Seller Initials ${blanks}`, 0.591, 0.915),
    ],
    [], [], [], [],
    [
      run('230', 0.0371, 0.4137),
      run('Total number of pages attached, including all addenda, reports, or any other documents. (', 0.0882, 0.4137),
      run('complete even if zero', 0.6057, 0.4137),
      run(') ______', 0.7299, 0.4137),
      signRow('Seller', 0.4525),
      signRow('Seller', 0.49),
    ],
    [signRow('Buyer', 0.2125)],
  ]
  const out = withFallbackSignatures(map, {
    pageCount: 8,
    formNumber: '020',
    documentName: 'Sellers Property Disclosure Statement - 020 OREF',
    pages,
  })
  const by = (ref: string) => out.find((f) => f.dataRef === ref)!

  it('signs the page 7 Seller block and the page 8 Buyer block, not the page 1 exclusion blocks', () => {
    expect(by('Text247')).toMatchObject({ type: 'signature', signerRole: 'seller', signerIndex: 0 })
    expect(by('Text249')).toMatchObject({ type: 'signature', signerRole: 'seller', signerIndex: 1 })
    expect(by('Text262')).toMatchObject({ type: 'signature', signerRole: 'buyer', signerIndex: 0 })
    for (const ref of ['Text186', 'Text202']) {
      expect(by(ref)).toMatchObject({ type: 'signature', signerRole: null, optional: true })
      expect(by(ref).signerIndex).toBeUndefined()
    }
  })

  it('gives the seller the questions: each Yes / No / Unknown is one required choice', () => {
    const answers = ['Check Box291', 'Check Box292', 'Check Box293'].map(by)
    for (const f of answers) expect(f).toMatchObject({ signerRole: 'seller', signerFills: true, group: { min: 1, max: 1 } })
    expect(new Set(answers.map((f) => f.group!.key)).size).toBe(1)
    expect(answers[0]!.prompt).toBe('A. Do you have legal authority to sell the Property?')
    expect(by('Text212')).toMatchObject({ signerRole: 'seller', signerFills: true })
  })

  it('makes the seller complete the page count, as line 230 says ("complete even if zero")', () => {
    expect(by('Text246')).toMatchObject({
      signerRole: 'seller',
      signerFills: true,
      mustComplete: true,
      prompt: 'Total number of pages attached, including all addenda, reports, or any other documents. (complete even if zero)',
    })
    expect(by('Text240')).toMatchObject({ signerRole: 'seller', signerFills: true })
    expect(by('Text240').mustComplete).toBeUndefined()
  })

  it('puts Buyer Initials on the left of the footer and Seller Initials on the right', () => {
    expect(['Text213.0', 'Text213.3'].map((r) => by(r).signerRole)).toEqual(['buyer', 'buyer'])
    expect(['Text214.0', 'Text214.3'].map((r) => by(r).signerRole)).toEqual(['seller', 'seller'])
  })

  it('marks the page 1 exclusion lines as the broker’s, so their "Seller signature" label cannot hand them back', () => {
    for (const ref of ['Text186', 'Text202']) expect(by(ref)).toMatchObject({ leaveForBroker: true })
  })

  it('keeps the page header (the property address) the broker’s, not the seller’s', () => {
    const header = { type: 'text' as const, page: 2, x: 0.257, y: 0.126, w: 0.683, h: 0.0164, dataRef: 'Text210', signerRole: null, optional: false, label: 'Text210' }
    const shaped = withFallbackSignatures([...map, header], { pageCount: 8, formNumber: '020', documentName: 'Sellers Property Disclosure Statement - 020 OREF', pages })
    expect(shaped.find((f) => f.dataRef === 'Text210')!.signerFills).toBeUndefined()
  })

  it('on the exempt version leaves pages 2 to 8, footers included, for the broker', () => {
    const exempt = withFallbackSignatures(map, { pageCount: 8, formNumber: '020', documentName: 'Sellers Property Disclosure Statement (Exempt Seller) - 020 OREF', pages })
    const f = (ref: string) => exempt.find((x) => x.dataRef === ref)!
    expect(f('Text186')).toMatchObject({ type: 'signature', signerRole: 'seller', signerIndex: 0 })
    for (const ref of ['Text213.0', 'Text214.0', 'Text247', 'Text262']) expect(f(ref)).toMatchObject({ signerRole: null, leaveForBroker: true })
  })
})

describe('withFallbackSignatures reads a version named for one side', () => {
  it('gives the 018 Seller advisory’s "Client" lines to the seller, though the blank names them "Backup Buyer"', () => {
    const line = (y: number, ref: string) => ({ type: 'text' as const, page: 1, x: 0.125, y, w: 0.509, h: 0.0218, dataRef: ref, signerRole: 'buyer' as const, optional: false, label: ref })
    const client = (y: number) => ({ str: `Client ${'_'.repeat(35)} Date/Time ${'_'.repeat(20)}`, x: 0.09, y, w: 0.83 })
    const map = [line(0.7526, 'Backup Buyer'), line(0.7905, 'Backup Buyer_2')]
    const input = { pageCount: 1, formNumber: '018', pages: [[client(0.773), client(0.81)]] }
    const seller = withFallbackSignatures(map, { ...input, documentName: 'Advisory Regarding Lead Based Paint - Seller - 018 OREF' })
    expect(seller.filter((f) => f.type === 'signature' && !f.fromStack).map((f) => [f.signerRole, f.signerIndex])).toEqual([
      ['seller', 0],
      ['seller', 1],
    ])
    const buyer = withFallbackSignatures(map, { ...input, documentName: 'Advisory Regarding Lead Based Paint - Buyer - 018 OREF' })
    expect(buyer.filter((f) => f.type === 'signature' && !f.fromStack).map((f) => f.signerRole)).toEqual(['buyer', 'buyer'])
  })
})

describe('withFallbackSignatures places the last-page stack only where it covers nothing', () => {
  it('never lays a box off the bottom of the page', () => {
    const map = withFallbackSignatures([], { pageCount: 1, formNumber: '001' })
    expect(map.length).toBeGreaterThan(0)
    expect(map.every((f) => f.y + f.h <= 0.97)).toBe(true)
  })

  it('drops a box that would cover printed text', () => {
    const text = { str: 'Seller acknowledges receipt of this addendum on the date below', x: 0.1, y: 0.8, w: 0.6 }
    const map = withFallbackSignatures([], { pageCount: 1, formNumber: '015', pages: [[text]] })
    expect(map.some((f) => f.y < 0.8 && f.y + f.h > 0.79)).toBe(false)
  })
})
