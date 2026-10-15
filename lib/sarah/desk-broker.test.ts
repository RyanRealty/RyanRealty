import { describe, expect, it } from 'vitest'
import { BROKERS } from '@/lib/brand/contact'
import {
  SARAH_DEFAULT_BROKER_SLUG,
  brokerJoinedLine,
  deskBrokerFromAssigned,
  deskBrokerSlug,
} from './desk-broker'

describe('deskBrokerFromAssigned', () => {
  it('defaults to Matt when nothing is assigned', () => {
    const matt = deskBrokerFromAssigned(null)
    expect(deskBrokerSlug(null)).toBe(SARAH_DEFAULT_BROKER_SLUG)
    expect(matt.slug).toBe('matt')
    expect(matt.firstName).toBe('Matt')
    expect(matt.fullName).toBe(BROKERS.matt.nameShort)
    expect(matt.photoSrc).toBe('/images/brokers/ryan-matt.png')
    expect(matt.phoneTel).toBe('+15417033095')
    expect(matt.contactHref).toBe('/contact?agent=matt')
    expect(brokerJoinedLine(matt)).toBe('Matt has joined')
  })

  it('uses Rebecca when the person record assigns her', () => {
    const rebecca = deskBrokerFromAssigned('rebecca')
    expect(rebecca.slug).toBe('rebecca')
    expect(rebecca.firstName).toBe('Rebecca')
    expect(rebecca.photoSrc).toBe('/images/brokers/peterson-rebecca.png')
    expect(rebecca.phoneTel).toBe('+15412503380')
    expect(rebecca.email).toBe(BROKERS.rebecca.email)
    expect(brokerJoinedLine(rebecca)).toBe('Rebecca has joined')
  })

  it('accepts a long Paul slug and still falls unknown values to Matt', () => {
    const paul = deskBrokerFromAssigned('paul-stevenson')
    expect(paul.slug).toBe('paul')
    expect(paul.firstName).toBe('Paul')
    expect(paul.phoneTel).toBe('+15415023436')
    expect(brokerJoinedLine(paul)).toBe('Paul has joined')
    expect(deskBrokerFromAssigned('not-a-broker').slug).toBe('matt')
    expect(deskBrokerFromAssigned('').slug).toBe('matt')
  })
})
