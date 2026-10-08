import { describe, expect, it } from 'vitest'
import { cmaClientPersistFields, linkUnclaimedCmaClient, type CmaClientLink } from './expired-owner-link'

const owner: CmaClientLink = {
  name: 'Owner Example',
  email: 'owner@example.com',
  phone: '+15415550100',
  personId: 63986,
}

describe('linkUnclaimedCmaClient', () => {
  it('fills a blank build from the skip-traced owner', () => {
    const linked = linkUnclaimedCmaClient({
      client: { name: null, email: null, phone: null },
      personId: null,
      owner,
    })
    expect(linked).toEqual(owner)
  })

  it('keeps a client the build already named', () => {
    const linked = linkUnclaimedCmaClient({
      client: { name: 'Asked Client', email: 'asked@example.com', phone: '+15415550199' },
      personId: 12,
      owner,
    })
    expect(linked).toEqual({
      name: 'Asked Client',
      email: 'asked@example.com',
      phone: '+15415550199',
      personId: 12,
    })
  })

  it('does not attach the owner when the email is a different person', () => {
    const linked = linkUnclaimedCmaClient({
      client: { name: null, email: 'other@example.com', phone: null },
      personId: null,
      owner,
    })
    expect(linked.email).toBe('other@example.com')
    expect(linked.personId).toBeNull()
    expect(linked.name).toBeNull()
  })

  it('fills a blank email when the person id already matches the owner', () => {
    const linked = linkUnclaimedCmaClient({
      client: { name: null, email: '  ', phone: null },
      personId: 63986,
      owner,
    })
    expect(linked.email).toBe('owner@example.com')
    expect(linked.personId).toBe(63986)
    expect(linked.name).toBe('Owner Example')
  })

  it('leaves the build alone when there is no owner', () => {
    const linked = linkUnclaimedCmaClient({
      client: { name: null, email: null, phone: null },
      personId: null,
      owner: null,
    })
    expect(linked).toEqual({ name: null, email: null, phone: null, personId: null })
  })
})

describe('cmaClientPersistFields', () => {
  it('omits nulls so an upsert cannot wipe a stored client', () => {
    expect(cmaClientPersistFields({ name: null, email: null, phone: null, personId: null })).toEqual({})
  })

  it('writes the fields that were filled', () => {
    expect(cmaClientPersistFields(owner)).toEqual({
      client_name: 'Owner Example',
      client_email: 'owner@example.com',
      client_phone: '+15415550100',
      person_id: 63986,
    })
  })
})
