import { describe, expect, it } from 'vitest'
import {
  BUYER_INTENT_EVENTS,
  BUYER_LISTING_VIEW_THRESHOLD,
  LISTING_VIEW_CAP,
  LISTING_VIEW_WINDOW_MS,
  MARKET_KEY_CAP,
  SELLER_INTENT_EVENTS,
  VISITOR_INTENT_STORAGE_KEY,
  applyPageVisit,
  classifyVisitorIntent,
  clearVisitorIntent,
  emptyVisitorIntentMemory,
  isVisitorIntentEvent,
  marketSlugFromPath,
  parseVisitorIntentMemory,
  primaryMarket,
  readVisitorIntentMemory,
  recordIntentEvent,
  recordPageVisit,
  visitorIntentDataLayerFields,
  type IntentStorage,
  type VisitorIntentMemory,
} from './visitor-intent'
import { visitorPageCategoryFromPath } from './page-type'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 14, 18, 0, 0)

function memoryStorage(): IntentStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

function brokenStorage(): IntentStorage {
  const boom = () => {
    throw new Error('SecurityError: storage is blocked')
  }
  return { getItem: boom, setItem: boom, removeItem: boom }
}

function mem(over: Partial<VisitorIntentMemory> = {}): VisitorIntentMemory {
  return { ...emptyVisitorIntentMemory(), ...over }
}

describe('the rule reads the one shared page category (page-type.ts)', () => {
  it('the paths these tests use classify as the CRM classifies them', () => {
    expect(visitorPageCategoryFromPath('/homes-for-sale/bend/nw-crossing/123-main-st-220216404')).toBe('listing_detail')
    expect(visitorPageCategoryFromPath('/sell')).toBe('seller_intent')
    expect(visitorPageCategoryFromPath('/buy/alerts')).toBe('buyer_intent')
    expect(visitorPageCategoryFromPath('/cities/bend')).toBe('area_guide')
  })
})

describe('classifyVisitorIntent', () => {
  it('a new browser is browsing', () => {
    expect(classifyVisitorIntent(emptyVisitorIntentMemory(), NOW)).toBe('browsing')
  })

  it(`${BUYER_LISTING_VIEW_THRESHOLD} listing views in the last 30 days make a buyer, 2 do not`, () => {
    expect(BUYER_LISTING_VIEW_THRESHOLD).toBe(3)
    expect(classifyVisitorIntent(mem({ listingViews: [NOW - 2 * DAY, NOW - DAY] }), NOW)).toBe('browsing')
    expect(classifyVisitorIntent(mem({ listingViews: [NOW - 20 * DAY, NOW - 2 * DAY, NOW - DAY] }), NOW)).toBe('buyer')
  })

  it('a listing view older than 30 days does not count', () => {
    const old = NOW - LISTING_VIEW_WINDOW_MS - DAY
    expect(classifyVisitorIntent(mem({ listingViews: [old, NOW - 2 * DAY, NOW - DAY] }), NOW)).toBe('browsing')
  })

  it('any buyer_intent page or buyer event makes a buyer, and never expires', () => {
    expect(classifyVisitorIntent(mem({ buyerPageAt: NOW - 400 * DAY }), NOW)).toBe('buyer')
    expect(classifyVisitorIntent(mem({ buyerActionAt: NOW - 400 * DAY }), NOW)).toBe('buyer')
  })

  it('any seller_intent page or seller event makes a seller', () => {
    expect(classifyVisitorIntent(mem({ sellerPageAt: NOW }), NOW)).toBe('seller')
    expect(classifyVisitorIntent(mem({ sellerActionAt: NOW }), NOW)).toBe('seller')
  })

  it('buyer and seller is both', () => {
    expect(classifyVisitorIntent(mem({ sellerPageAt: NOW, buyerActionAt: NOW }), NOW)).toBe('both')
    expect(classifyVisitorIntent(mem({ sellerActionAt: NOW, listingViews: [NOW, NOW, NOW] }), NOW)).toBe('both')
  })

  it('the intent events are the brief list', () => {
    expect([...BUYER_INTENT_EVENTS]).toEqual(['save_listing', 'schedule_tour_click', 'ask_question_click', 'tour_requested'])
    expect([...SELLER_INTENT_EVENTS]).toEqual(['address_submit', 'place_value_answer'])
    expect(isVisitorIntentEvent('call_initiated')).toBe(false)
    expect(isVisitorIntentEvent('view_listing')).toBe(false)
  })
})

describe('marketSlugFromPath', () => {
  it.each([
    ['/homes-for-sale/bend', 'bend'],
    ['/homes-for-sale/Bend/', 'bend'],
    ['/homes-for-sale/bend/under-500k', 'bend'],
    ['/homes-for-sale/bend/northwest-crossing', 'bend'],
    ['/homes-for-sale/redmond/eagle-crest/123-main-st-220216404', 'redmond'],
    ['/homes-for-sale/la-pine?bbox=1,2,3,4', 'la-pine'],
    ['/cities/sisters', 'sisters'],
    ['/cities/bend/old-bend/living', 'bend'],
    ['/open-houses/sunriver', 'sunriver'],
    ['/price-drops/prineville', 'prineville'],
    ['/housing-market/bend', 'bend'],
    ['/communities/tetherow', 'tetherow'],
    ['/communities/bend-northwest-crossing/hoa', 'bend-northwest-crossing'],
  ])('%s -> %s', (path, slug) => {
    expect(marketSlugFromPath(path)).toBe(slug)
  })

  it.each([
    '/',
    '/homes-for-sale',
    '/homes-for-sale/luxury',
    '/homes-for-sale/listing/20251020154621696143598238',
    '/homes-for-sale/medford/x/123-main-st-220216404',
    '/subdivisions/awbrey-butte',
    '/listing/220216404',
    '/oregon/grants-pass',
    '/central-oregon/golf',
    '/central-oregon/trails/smith-rock',
    '/housing-market/central-oregon',
    '/housing-market/reports/monthly',
    '/communities',
    '/communities/Not A Slug!',
    '/zip/97702',
    '/areas/west-side',
    '/sell',
    '/buy/alerts',
    '/blog/bend-market',
    '/motivated-sellers/madras',
  ])('%s -> null', (path) => {
    expect(marketSlugFromPath(path)).toBeNull()
  })

  it('never throws on a malformed escape', () => {
    expect(() => marketSlugFromPath('/communities/%E0%A4%A')).not.toThrow()
    expect(marketSlugFromPath(null)).toBeNull()
  })
})

describe('primaryMarket', () => {
  it('is the market with the most views', () => {
    expect(primaryMarket(mem({ markets: { bend: 2, redmond: 5 } }))).toBe('redmond')
    expect(primaryMarket(mem())).toBeNull()
  })

  it('a tie keeps the stored primary market', () => {
    expect(primaryMarket(mem({ markets: { bend: 3, redmond: 3 }, primaryMarket: 'redmond' }))).toBe('redmond')
    expect(primaryMarket(mem({ markets: { redmond: 3, bend: 3 }, primaryMarket: 'bend' }))).toBe('bend')
  })

  it('a market overtakes the stored one only by passing it', () => {
    let m = mem()
    m = applyPageVisit(m, '/cities/bend', NOW)
    expect(m.primaryMarket).toBe('bend')
    m = applyPageVisit(m, '/cities/redmond', NOW)
    expect(m.primaryMarket).toBe('bend')
    m = applyPageVisit(m, '/cities/redmond', NOW)
    expect(m.primaryMarket).toBe('redmond')
    m = applyPageVisit(m, '/cities/bend', NOW)
    expect(m.primaryMarket).toBe('redmond')
  })

  it('at the cap, two new markets visited in turn do not evict each other', () => {
    const full: Record<string, number> = {}
    for (let i = 0; i < MARKET_KEY_CAP; i++) full[`old-${i}`] = 5
    let m = mem({ markets: full, primaryMarket: 'old-0' })
    for (const p of ['/cities/bend', '/cities/redmond', '/cities/bend', '/cities/redmond', '/cities/bend']) m = applyPageVisit(m, p, NOW)
    expect(m.markets.bend).toBe(3)
    expect(m.markets.redmond).toBe(2)
    expect(Object.keys(m.markets)).toHaveLength(MARKET_KEY_CAP)
  })

  it(`counts at most ${MARKET_KEY_CAP} markets and never drops the primary`, () => {
    let m = mem({ markets: { bend: 9 }, primaryMarket: 'bend' })
    for (let i = 0; i < MARKET_KEY_CAP + 10; i++) m = applyPageVisit(m, `/communities/place-${i}`, NOW)
    expect(Object.keys(m.markets)).toHaveLength(MARKET_KEY_CAP)
    expect(m.markets.bend).toBe(9)
    expect(m.primaryMarket).toBe('bend')
    expect(m.markets[`place-${MARKET_KEY_CAP + 9}`]).toBe(1)
  })
})

describe('applyPageVisit', () => {
  it(`keeps at most ${LISTING_VIEW_CAP} listing views, all inside the window`, () => {
    let m = mem({ listingViews: [NOW - 40 * DAY] })
    for (let i = 0; i < LISTING_VIEW_CAP + 5; i++) m = applyPageVisit(m, '/listing/220216404', NOW + i)
    expect(m.listingViews).toHaveLength(LISTING_VIEW_CAP)
    expect(m.listingViews.every((t) => t >= NOW)).toBe(true)
    expect(m.intent).toBe('buyer')
  })

  it('a seller page then a buyer page is both, and the label is stored', () => {
    let m = applyPageVisit(mem(), '/sell', NOW)
    expect(m.intent).toBe('seller')
    m = applyPageVisit(m, '/buy/alerts', NOW)
    expect(m.intent).toBe('both')
  })

  it('does not change the memory it was given', () => {
    const before = mem()
    applyPageVisit(before, '/homes-for-sale/bend/x/1-main-st-220216404', NOW)
    expect(before).toEqual(emptyVisitorIntentMemory())
  })
})

describe('recordPageVisit and recordIntentEvent (storage)', () => {
  it('records nothing and returns nulls without analytics consent', () => {
    const s = memoryStorage()
    expect(recordPageVisit('/sell', { consent: false, storage: s, now: NOW })).toEqual({
      visitor_intent: null,
      primary_market: null,
      changed: false,
    })
    expect(recordIntentEvent('address_submit', { consent: false, storage: s, now: NOW }).visitor_intent).toBeNull()
    expect(s.data.size).toBe(0)
  })

  it('stores the memory under rr_visitor_intent_v1 and reports a change once', () => {
    const s = memoryStorage()
    expect(VISITOR_INTENT_STORAGE_KEY).toBe('rr_visitor_intent_v1')
    const first = recordPageVisit('/cities/bend', { consent: true, storage: s, now: NOW })
    expect(first).toEqual({ visitor_intent: 'browsing', primary_market: 'bend', changed: false })
    const second = recordIntentEvent('address_submit', { consent: true, storage: s, now: NOW + 1 })
    expect(second).toEqual({ visitor_intent: 'seller', primary_market: 'bend', changed: true })
    const third = recordIntentEvent('place_value_answer', { consent: true, storage: s, now: NOW + 2 })
    expect(third.changed).toBe(false)
    const stored = JSON.parse(s.data.get(VISITOR_INTENT_STORAGE_KEY) ?? 'null')
    expect(stored).toMatchObject({ intent: 'seller', primaryMarket: 'bend', sellerActionAt: NOW + 2, markets: { bend: 1 } })
  })

  it('three listing views make a buyer across calls', () => {
    const s = memoryStorage()
    const views = ['/listing/1', '/listing/2', '/listing/3'].map((p, i) => recordPageVisit(p, { consent: true, storage: s, now: NOW + i }))
    expect(views.map((v) => v.visitor_intent)).toEqual(['browsing', 'browsing', 'buyer'])
    expect(views[2].changed).toBe(true)
  })

  it('a buyer event makes a buyer; a name that is not an intent event records nothing', () => {
    const s = memoryStorage()
    expect(recordIntentEvent('click_cta', { consent: true, storage: s, now: NOW }).visitor_intent).toBeNull()
    expect(s.data.size).toBe(0)
    expect(recordIntentEvent('schedule_tour_click', { consent: true, storage: s, now: NOW })).toEqual({
      visitor_intent: 'buyer',
      primary_market: null,
      changed: true,
    })
  })

  it('a broken storage never throws: reads as empty, the label is still computed', () => {
    const s = brokenStorage()
    expect(() => recordPageVisit('/sell', { consent: true, storage: s, now: NOW })).not.toThrow()
    expect(recordPageVisit('/sell', { consent: true, storage: s, now: NOW }).visitor_intent).toBe('seller')
    expect(readVisitorIntentMemory(s)).toEqual(emptyVisitorIntentMemory())
    expect(() => clearVisitorIntent(s)).not.toThrow()
    expect(recordPageVisit('/cities/bend', { consent: true, storage: null, now: NOW }).primary_market).toBe('bend')
  })

  it('garbage in storage reads as empty, and odd fields are dropped', () => {
    expect(parseVisitorIntentMemory('{not json')).toEqual(emptyVisitorIntentMemory())
    expect(parseVisitorIntentMemory('[1,2]')).toEqual(emptyVisitorIntentMemory())
    const m = parseVisitorIntentMemory(
      JSON.stringify({
        listingViews: [NOW, 'x', -1, null],
        sellerPageAt: 'yesterday',
        markets: { bend: 2, 'Bad Slug': 3, sisters: -1 },
        primaryMarket: 'redmond',
        intent: 'landlord',
      }),
    )
    expect(m).toEqual({ ...emptyVisitorIntentMemory(), listingViews: [NOW], markets: { bend: 2 } })
  })

  it('clearVisitorIntent forgets the browser', () => {
    const s = memoryStorage()
    recordPageVisit('/sell', { consent: true, storage: s, now: NOW })
    clearVisitorIntent(s)
    expect(s.data.size).toBe(0)
  })
})

describe('visitorIntentDataLayerFields', () => {
  it('leaves out null fields so GTM keeps no undefined key', () => {
    expect(visitorIntentDataLayerFields({ visitor_intent: 'buyer', primary_market: null })).toEqual({ visitor_intent: 'buyer' })
    expect(visitorIntentDataLayerFields({ visitor_intent: null, primary_market: null })).toEqual({})
    expect(visitorIntentDataLayerFields({ visitor_intent: 'both', primary_market: 'bend' })).toEqual({
      visitor_intent: 'both',
      primary_market: 'bend',
    })
  })
})
