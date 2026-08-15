import { describe, expect, it } from 'vitest'
import {
  classifyArrival,
  lastThingFromHouse,
  persistIntent,
  readLastThing,
  welcomeThing,
  writeLastThing,
  type LastThing,
  type StorageLike,
} from './arrival-intent'

function memoryStorage(init: Record<string, string> = {}): StorageLike {
  const data = { ...init }
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
    setItem(key, value) {
      data[key] = value
    },
  }
}

const HOME = 'https://ryan-realty.com/'
const HOUSE: LastThing = {
  kind: 'house',
  label: '61281 McRoberts',
  href: '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727',
}

describe('classifyArrival', () => {
  it('google referrer is inbound and does not quiz', () => {
    const arrival = classifyArrival({
      referrer: 'https://www.google.com/search?q=ryan+realty',
      href: HOME,
    })
    expect(arrival.kind).toBe('inbound')
    expect(arrival.showQuiz).toBe(false)
    expect(arrival.showWelcome).toBe(false)
    expect(arrival.source).toBe('inbound')
    expect(arrival.intent).toBe('buyer')
  })

  it('gclid is inbound and does not quiz', () => {
    const arrival = classifyArrival({
      referrer: '',
      href: 'https://ryan-realty.com/?gclid=abc123',
    })
    expect(arrival.kind).toBe('inbound')
    expect(arrival.showQuiz).toBe(false)
    expect(arrival.source).toBe('inbound')
  })

  it('utm is inbound and does not quiz', () => {
    const arrival = classifyArrival({
      referrer: '',
      href: 'https://ryan-realty.com/?utm_source=newsletter&utm_medium=email',
    })
    expect(arrival.kind).toBe('inbound')
    expect(arrival.showQuiz).toBe(false)
    expect(arrival.source).toBe('inbound')
  })

  it('rr_last_thing house is welcome and does not quiz', () => {
    const arrival = classifyArrival({
      referrer: '',
      href: HOME,
      lastThing: HOUSE,
    })
    expect(arrival.kind).toBe('returner')
    expect(arrival.showQuiz).toBe(false)
    expect(arrival.showWelcome).toBe(true)
    expect(arrival.thing).toEqual(HOUSE)
    expect(arrival.source).toBe('return')
  })

  it('blank referrer and no thing is the unknown_direct quiz', () => {
    const arrival = classifyArrival({
      referrer: '',
      href: HOME,
    })
    expect(arrival.kind).toBe('unknown_direct')
    expect(arrival.showQuiz).toBe(true)
    expect(arrival.showWelcome).toBe(false)
    expect(arrival.source).toBe('unknown_direct')
  })

  it('Look is a counted intent', () => {
    const store = memoryStorage()
    persistIntent('look', store)
    expect(store.getItem('rr_intent')).toBe('look')
    const afterLook = classifyArrival({
      referrer: '',
      href: HOME,
      declaredIntent: 'look',
    })
    expect(afterLook.showQuiz).toBe(false)
    expect(afterLook.intent).toBe('look')
  })
})

describe('welcomeThing', () => {
  it('names the house they left, not a person', () => {
    const welcome = welcomeThing(HOUSE)
    expect(welcome.line).toBe('Welcome back. 61281 McRoberts.')
    expect(welcome.href).toBe(HOUSE.href)
    expect(welcome.label).toBe('61281 McRoberts')
    expect(welcome.line).not.toMatch(/account|sign in|cookie/i)
  })
})

describe('writeLastThing / readLastThing', () => {
  it('round-trips a house into session storage JSON', () => {
    const store = memoryStorage()
    writeLastThing(HOUSE, store)
    expect(readLastThing(store)).toEqual(HOUSE)
  })

  it('builds a house label from the listing path when street is missing', () => {
    expect(
      lastThingFromHouse({
        path: '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727',
      }),
    ).toEqual({
      kind: 'house',
      label: '61281 Mcroberts',
      href: '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727',
    })
  })
})
