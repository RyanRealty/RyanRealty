import { describe, expect, it } from 'vitest'
import {
  BUYER_ANSWER_DEFS,
  buyerAnswerByPath,
  buyerAnswerSitemapPaths,
  communityBuyerAnswerParams,
  isBuyerAnswerPreset,
  neighborhoodBuyerAnswerParams,
  vsBuyerAnswerParams,
} from './registry'
import { MASTER_HOA_DURABLE_SLUGS, STR_PUBLIC_SLUGS, sourcedStr, masterHoaAnnual } from './sourced'
import { communityPath } from '@/lib/communities/community-public-pair'

describe('buyer-answer registry', () => {
  it('holds 25 to 80 long-tail queries', () => {
    expect(BUYER_ANSWER_DEFS.length).toBeGreaterThanOrEqual(25)
    expect(BUYER_ANSWER_DEFS.length).toBeLessThanOrEqual(80)
  })

  it('gives each query a unique path and id', () => {
    const paths = BUYER_ANSWER_DEFS.map((def) => def.path)
    const ids = BUYER_ANSWER_DEFS.map((def) => def.id)
    expect(new Set(paths).size).toBe(paths.length)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only lists HOA pages for sourced master assessments', () => {
    const hoa = BUYER_ANSWER_DEFS.filter((def) => def.kind === 'hoa')
    expect(hoa.map((def) => def.slug).sort()).toEqual(['caldera-springs', 'sunriver', 'tetherow'])
    for (const slug of MASTER_HOA_DURABLE_SLUGS) {
      expect(masterHoaAnnual(slug)).toBeGreaterThan(0)
    }
    expect(masterHoaAnnual('eagle-crest')).toBeNull()
  })

  it('only lists STR pages for sourced resort rules', () => {
    const str = BUYER_ANSWER_DEFS.filter((def) => def.kind === 'str')
    expect(str.map((def) => def.slug).sort()).toEqual(['juniper-preserve', 'tetherow'])
    expect(sourcedStr('tetherow')?.sourceHref).toContain('tetherowowners.com')
    expect(sourcedStr('juniper-preserve')?.sourceHref).toContain('juniperpreserve.com')
    expect(sourcedStr('sunriver')).toBeNull()
    expect(STR_PUBLIC_SLUGS).toHaveLength(2)
  })

  it('uses the public Juniper Preserve path, not the durable pronghorn key', () => {
    const living = buyerAnswerByPath('/communities/juniper-preserve/living')
    expect(living?.slug).toBe('juniper-preserve')
    expect(communityPath('pronghorn')).toBe('/communities/juniper-preserve')
    expect(buyerAnswerSitemapPaths()).not.toContain('/communities/pronghorn/living')
  })

  it('emits child routes for the sitemap and keeps presets on existing search paths', () => {
    const sitemap = buyerAnswerSitemapPaths()
    expect(sitemap).toContain('/communities/tetherow/hoa')
    expect(sitemap).toContain('/cities/bend/vs/redmond')
    expect(sitemap.every((path) => !path.startsWith('/homes-for-sale/'))).toBe(true)
    expect(BUYER_ANSWER_DEFS.some((def) => def.path === '/homes-for-sale/bend/under-500k')).toBe(true)
    expect(BUYER_ANSWER_DEFS.some((def) => def.path === '/new-construction')).toBe(true)
    expect(isBuyerAnswerPreset('bend', 'under-500k')).toBe(true)
    expect(isBuyerAnswerPreset('bend', 'over-1-5m')).toBe(true)
    expect(isBuyerAnswerPreset('central-oregon', 'acreage')).toBe(true)
    expect(isBuyerAnswerPreset('central-oregon', 'under-500k')).toBe(true)
    expect(isBuyerAnswerPreset('bend', 'pending')).toBe(false)
    expect(BUYER_ANSWER_DEFS.some((def) => def.path === '/homes-for-sale/acreage')).toBe(true)
    expect(BUYER_ANSWER_DEFS.some((def) => def.path === '/homes-for-sale/under-500k')).toBe(true)
    expect(BUYER_ANSWER_DEFS.some((def) => def.path === '/homes-for-sale/bend/over-1-5m')).toBe(true)
  })

  it('adds batch-2 community and neighborhood children only where inventory supports them', () => {
    expect(communityBuyerAnswerParams('living', 'community').map((row) => row.slug)).toEqual(
      expect.arrayContaining(['broken-top', 'brasada-ranch', 'three-rivers']),
    )
    expect(communityBuyerAnswerParams('cost', 'community').map((row) => row.slug)).toEqual(
      expect.arrayContaining([
        'broken-top',
        'brasada-ranch',
        'three-rivers',
        'juniper-preserve',
        'eagle-crest',
        'black-butte-ranch',
      ]),
    )
    expect(BUYER_ANSWER_DEFS.some((def) => def.path.includes('/crosswater/'))).toBe(false)
    expect(BUYER_ANSWER_DEFS.some((def) => def.path.includes('/vandevert'))).toBe(false)
    expect(BUYER_ANSWER_DEFS.some((def) => def.path.includes('shevlin'))).toBe(false)
    expect(BUYER_ANSWER_DEFS.some((def) => def.path.includes('discovery-west'))).toBe(false)
    expect(neighborhoodBuyerAnswerParams('living').map((row) => row.neighborhoodSlug)).toEqual(
      expect.arrayContaining([
        'old-bend',
        'southeast-bend',
        'century-west',
        'southwest-bend',
        'summit-west',
        'old-farm-district',
      ]),
    )
    expect(buyerAnswerByPath('/cities/bend/from-out-of-state')?.kind).toBe('from-out-of-state')
    expect(buyerAnswerByPath('/communities/sunriver/second-home')?.kind).toBe('second-home')
    expect(buyerAnswerByPath('/cities/redmond/buying')?.kind).toBe('buying')
    expect(buyerAnswerSitemapPaths()).toContain('/cities/bend/old-bend/living')
    expect(buyerAnswerSitemapPaths()).toContain('/communities/broken-top/cost')
  })

  it('builds static params from the registry', () => {
    expect(communityBuyerAnswerParams('living', 'community').map((row) => row.slug)).toContain('tetherow')
    expect(communityBuyerAnswerParams('hoa', 'community')).toHaveLength(3)
    expect(vsBuyerAnswerParams('city')).toEqual(
      expect.arrayContaining([
        { slug: 'bend', other: 'redmond' },
        { slug: 'bend', other: 'sisters' },
      ]),
    )
  })
})
