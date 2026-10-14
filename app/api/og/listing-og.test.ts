import { beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.fn()
const renderCard = vi.fn((input: Record<string, unknown>) => {
  return new Response(JSON.stringify(input), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
})

vi.mock('@/lib/data/listings/getListingDetail', () => ({
  getListingLookup: (id: string) => lookup(id),
}))

vi.mock('@/lib/og/share-card', () => ({
  renderShareCard: (input: Record<string, unknown>) => renderCard(input),
}))

const { GET } = await import('./route')

const LISTING = {
  listingKey: '20260824231914656196000000',
  listNumber: '220227635',
  status: 'Active',
  listPrice: 634_900,
  closePrice: null,
  propertyType: 'A',
  propertySubType: 'Single Family Residence',
  subdivisionName: 'Acapella',
  city: 'Bend',
  postalCode: '97702',
  streetNumber: '61637',
  streetDirPrefix: 'SE',
  streetName: 'Evie',
  streetSuffix: 'Drive',
  beds: 4,
  baths: 3,
  photoUrl: 'https://cdn.resize.sparkplatform.com/ore/hero.jpg',
}

beforeEach(() => {
  lookup.mockReset()
  renderCard.mockClear()
})

describe('/api/og listing cards', () => {
  it('resolves an MLS ListNumber and paints the hero plus address and price', async () => {
    lookup.mockResolvedValue({ kind: 'ok', listing: LISTING })
    const res = await GET(new Request('http://localhost/api/og?type=listing&id=220227635'))
    expect(lookup).toHaveBeenCalledWith('220227635')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.photoSrc).toBe(LISTING.photoUrl)
    expect(body.title).toBe('61637 SE Evie Drive')
    expect(body.subtitle).toBe('$634,900 · 4 bed, 3 bath')
  })

  it('resolves a RETS ListingKey the same way', async () => {
    lookup.mockResolvedValue({ kind: 'ok', listing: LISTING })
    await GET(
      new Request('http://localhost/api/og?type=listing&id=20260824231914656196000000'),
    )
    expect(lookup).toHaveBeenCalledWith('20260824231914656196000000')
    expect(renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ photoSrc: LISTING.photoUrl }),
    )
  })

  it('falls back to the default aerial only when the listing has no photo', async () => {
    lookup.mockResolvedValue({ kind: 'ok', listing: { ...LISTING, photoUrl: null } })
    const res = await GET(new Request('http://localhost/api/og?type=listing&id=220227635'))
    const body = await res.json()
    expect(body.photoSrc).toBeNull()
    expect(body.title).toBe('Bend · Central Oregon')
    expect(body.subtitle).toBeUndefined()
  })

  it('falls back to the default card when the listing is missing', async () => {
    lookup.mockResolvedValue({ kind: 'missing' })
    const res = await GET(new Request('http://localhost/api/og?type=listing&id=22054302'))
    const body = await res.json()
    expect(body.title).toBe('Bend · Central Oregon')
    expect(body.photoSrc).toBeNull()
  })
})
