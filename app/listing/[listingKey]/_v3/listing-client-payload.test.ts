import { describe, expect, it } from 'vitest'
import type { ListingDetail } from '@/lib/data/types/listing'
import type { Broker } from '@/lib/data/types/broker'
import { pickPriceCtaListing, slimListingMedia, slimPublicBroker } from './listing-client-payload'

describe('listing client payload', () => {
  it('picks the ask-strip fields and drops photos and remarks', () => {
    const listing = {
      listingKey: 'k',
      listNumber: 'n',
      listPrice: 100,
      status: 'Active',
      streetNumber: '1',
      streetName: 'Main',
      city: 'Bend',
      publicRemarks: 'secret remarks',
      photos: [{ url: 'https://cdn.example/a.jpg', order: 0 }],
      bio: 'no',
    } as unknown as ListingDetail
    const picked = pickPriceCtaListing(listing)
    expect(picked.listingKey).toBe('k')
    expect(picked.listPrice).toBe(100)
    expect(picked.city).toBe('Bend')
    expect('photos' in picked).toBe(false)
    expect('publicRemarks' in picked).toBe(false)
  })

  it('strips photo width/height from gallery media', () => {
    const slim = slimListingMedia([
      { url: '/a.jpg', caption: 'Front', order: 0, width: 1600, height: 1200 },
    ])
    expect(slim).toEqual([{ url: '/a.jpg', caption: 'Front', order: 0 }])
  })

  it('drops broker bios and Gmail signatures', () => {
    const broker = {
      slug: 'matthew-ryan',
      fullName: 'Matt Ryan',
      title: 'Principal Broker',
      email: 'matt@ryan-realty.com',
      phoneDirect: '541.213.6706',
      phoneFub: '541.213.6706',
      headshotPng: '/images/brokers/ryan-matt.png',
      headshotJpg: '/images/brokers/ryan-matt.jpg',
      licenseNumber: '201212345',
      bio: 'A long biography. '.repeat(80),
      isPrincipal: true,
      gmailSignatureHtml: '<div>huge signature</div>'.repeat(40),
      emailSignature: 'plain signature',
    } as Broker
    const slim = slimPublicBroker(broker)
    expect(slim.fullName).toBe('Matt Ryan')
    expect(slim.bio).toBeNull()
    expect(slim.gmailSignatureHtml).toBeNull()
    expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(broker).length / 2)
  })
})
