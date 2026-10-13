import { describe, expect, it } from 'vitest'
import { generateBlogSchema, generateBrokerSchema, generateListingSchema } from './structured-data'
import { listingDetailPath } from './slug'
import { siteOrigin } from './site-origin'
import { BROKERS } from './brand/contact'
import { brokerPersonId } from './site/broker-entity'

describe('structured-data canonical URLs', () => {
  it('uses canonical /team URL for brokers', () => {
    const schema = generateBrokerSchema({
      display_name: 'Alex Broker',
      slug: 'alex-broker',
    })
    expect(schema.url).toMatch(/\/team\/alex-broker$/)
    expect(schema.url).not.toMatch(/\/agents\//)
  })

  it('uses canonical listing detail URL for listing schema', () => {
    const expectedPath = listingDetailPath(
      'abc123',
      {
        streetNumber: '1234',
        streetName: 'Pine St',
        city: 'Bend',
        state: 'OR',
        postalCode: '97701',
      },
      {
        city: 'Bend',
        subdivision: 'Northwest Crossing',
      }
    )
    const schema = generateListingSchema(
      {
        listing_key: 'abc123',
        subdivision_name: 'Northwest Crossing',
      },
      {
        street_number: '1234',
        street_name: 'Pine St',
        city: 'Bend',
        state: 'OR',
        postal_code: '97701',
      }
    )
    // The one origin (lib/site-origin.ts): the Vercel alias in the env folds to the apex.
    expect(schema.url).toBe(`${siteOrigin()}${expectedPath}`)
    expect(schema.url).not.toMatch(/vercel\.app/)
    expect(schema.url).not.toMatch(/\/listings\//)
  })
})

describe('generateBlogSchema author is one Person', () => {
  const founderId = brokerPersonId(siteOrigin(), BROKERS.matt.slug)

  it('always references the founder Person @id', () => {
    expect(founderId).toBe('https://ryan-realty.com/team/matthew-ryan#person')
    const schema = generateBlogSchema({
      title: 'Bend market notes',
      slug: 'bend-market-notes',
      author_name: 'Matt Ryan',
      author_slug: 'matt-ryan',
      published_at: '2026-10-01T00:00:00.000Z',
    })
    expect(schema['@type']).toBe('BlogPosting')
    expect(schema.author).toEqual({
      '@type': 'Person',
      '@id': founderId,
      name: 'Matt Ryan',
      url: `${siteOrigin()}/team/matthew-ryan`,
    })
    expect(schema.publisher).toEqual({ '@id': `${siteOrigin()}#organization` })
  })

  it('still uses the founder @id when author_slug is missing', () => {
    const schema = generateBlogSchema({
      title: 'Untitled note',
      slug: 'untitled-note',
    })
    expect((schema.author as { '@id': string })['@id']).toBe(founderId)
    expect((schema.author as { name: string }).name).toBe(BROKERS.matt.name)
  })

  it('does not follow a different author_slug off the founder node', () => {
    const schema = generateBlogSchema({
      title: 'Other byline',
      slug: 'other-byline',
      author_name: 'Paul Stevenson',
      author_slug: 'paul-stevenson',
    })
    expect((schema.author as { '@id': string })['@id']).toBe(founderId)
    expect((schema.author as { url: string }).url).toBe(`${siteOrigin()}/team/matthew-ryan`)
    expect((schema.author as { name: string }).name).toBe('Paul Stevenson')
  })
})
