import { test, expect } from 'vitest'
import {
  titleCaseSlug,
  resolveSourceLabel,
  formatInt,
  formatPricePaid,
  homeSpecFragments,
} from './source-labels'

test('resolveSourceLabel maps known slugs to friendly labels', () => {
  expect(resolveSourceLabel('seller-lp')).toBe('Seller landing page')
  expect(resolveSourceLabel('inbound-sms')).toBe('Inbound text')
  expect(resolveSourceLabel('inbound-call')).toBe('Inbound call')
  // underscore variants too
  expect(resolveSourceLabel('seller_lp')).toBe('Seller landing page')
  // case-insensitive
  expect(resolveSourceLabel('SELLER-LP')).toBe('Seller landing page')
})

test('resolveSourceLabel title-cases unknown slugs', () => {
  expect(resolveSourceLabel('mystery_channel-here')).toBe('Mystery Channel Here')
})

test('resolveSourceLabel falls back to firstTouch then to Source unknown', () => {
  expect(resolveSourceLabel(null, { source: 'referral' })).toBe('Referral')
  expect(resolveSourceLabel('', { source: 'organic' })).toBe('Organic search')
  expect(resolveSourceLabel(null, null)).toBe('Source unknown')
  expect(resolveSourceLabel(undefined)).toBe('Source unknown')
  expect(resolveSourceLabel('   ')).toBe('Source unknown')
})

test('titleCaseSlug handles mixed separators', () => {
  expect(titleCaseSlug('open-house')).toBe('Open House')
  expect(titleCaseSlug('a_b c')).toBe('A B C')
})

test('formatInt adds thousands separators', () => {
  expect(formatInt(1850)).toBe('1,850')
  expect(formatInt(0)).toBe('0')
})

test('formatPricePaid rounds to nearest thousand and prefixes $', () => {
  expect(formatPricePaid(894750)).toBe('$895,000')
  expect(formatPricePaid(475000)).toBe('$475,000')
})

test('formatPricePaid returns null for missing or invalid prices (never a fake price)', () => {
  expect(formatPricePaid(null)).toBeNull()
  expect(formatPricePaid(undefined)).toBeNull()
  expect(formatPricePaid(0)).toBeNull()
  expect(formatPricePaid(-100)).toBeNull()
  expect(formatPricePaid(Number.NaN)).toBeNull()
})

test('homeSpecFragments includes only present specs', () => {
  expect(
    homeSpecFragments({ beds: 3, baths: 2, sqft: 1850, neighborhood: 'Awbrey Butte' }),
  ).toEqual(['3 bed', '2 bath', '1,850 sqft', 'Awbrey Butte'])

  expect(homeSpecFragments({ beds: 3, baths: null, sqft: null, neighborhood: null })).toEqual([
    '3 bed',
  ])

  expect(homeSpecFragments({})).toEqual([])
})
