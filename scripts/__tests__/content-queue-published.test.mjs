import { describe, expect, it } from 'vitest'
import { buildRequest, publicUrl, validateRequest } from '../content-queue/publish.mjs'
import {
  claimSlot,
  isDue,
  loadPublishedKeys,
  insertPublished,
  ptDate,
  releaseSlot,
  scheduledPtDate,
  selectDue,
  slotKey,
} from '../content-queue/published-log.mjs'

describe('content-queue published log', () => {
  it('maps scheduled_at onto a PT calendar date', () => {
    expect(scheduledPtDate('2026-10-20T09:00:00-07:00')).toBe('2026-10-20')
    expect(scheduledPtDate('2026-10-21T00:30:00-07:00')).toBe('2026-10-21')
    expect(scheduledPtDate('not-a-date')).toBeNull()
  })

  it('today-only due matches that PT date', () => {
    expect(isDue({ scheduledAt: '2026-10-20T09:00:00-07:00', today: '2026-10-20' })).toBe(true)
    expect(isDue({ scheduledAt: '2026-10-19T09:00:00-07:00', today: '2026-10-20' })).toBe(false)
  })

  it('catch-up includes missed days on or before today', () => {
    expect(isDue({ scheduledAt: '2026-10-19T09:00:00-07:00', today: '2026-10-20', catchUp: true })).toBe(true)
    expect(isDue({ scheduledAt: '2026-10-20T09:00:00-07:00', today: '2026-10-20', catchUp: true })).toBe(true)
    expect(isDue({ scheduledAt: '2026-10-21T09:00:00-07:00', today: '2026-10-20', catchUp: true })).toBe(false)
  })

  it('slot key is content item + channel + date', () => {
    const a = slotKey({ item: 'real-estate-commission-bend-oregon', channel: 'gbp', date: '2026-10-20' })
    const dup = slotKey({ item: 'real-estate-commission-bend-oregon', channel: 'gbp', date: '2026-10-20' })
    const otherDay = slotKey({ item: 'real-estate-commission-bend-oregon', channel: 'gbp', date: '2026-10-21' })
    const otherChannel = slotKey({ item: 'real-estate-commission-bend-oregon', channel: 'x-post-1', date: '2026-10-20' })
    expect(a).toBe(dup)
    expect(a).not.toBe(otherDay)
    expect(a).not.toBe(otherChannel)
  })

  it('claimSlot makes a duplicate publish impossible', () => {
    const published = new Set()
    const key = slotKey({ item: 'how-to-price-your-bend-home', channel: 'x-post-1', date: '2026-10-29' })
    expect(claimSlot(published, key)).toEqual({ ok: true })
    expect(claimSlot(published, key)).toEqual({ ok: false, reason: 'already published' })
    releaseSlot(published, key)
    expect(claimSlot(published, key)).toEqual({ ok: true })
  })

  it('selectDue skips already-published slots and catches up the rest', () => {
    const drafts = [
      { item: 'a', channel: 'gbp', scheduledAt: '2026-10-18T09:00:00-07:00' },
      { item: 'b', channel: 'x-post-1', scheduledAt: '2026-10-20T12:00:00-07:00' },
      { item: 'c', channel: 'gbp', scheduledAt: '2026-10-21T09:00:00-07:00' },
    ]
    const published = new Set([slotKey({ item: 'a', channel: 'gbp', date: '2026-10-18' })])
    const due = selectDue(drafts, { today: '2026-10-20', catchUp: true, published })
    expect(due.map((d) => d.item)).toEqual(['b'])
  })

  it('insertPublished treats HTTP 409 as already published', async () => {
    const fetchImpl = async () => ({ status: 409, ok: false })
    const r = await insertPublished({
      fetchImpl,
      url: 'https://example.supabase.co',
      key: 'service',
      row: { item: 'a', channel: 'gbp', date: '2026-10-20' },
    })
    expect(r).toEqual({ ok: false, reason: 'already published' })
  })

  it('loadPublishedKeys rebuilds the unique set', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => [{ content_item: 'a', channel: 'gbp', published_date: '2026-10-20' }],
    })
    const { keys, error } = await loadPublishedKeys({
      fetchImpl,
      url: 'https://example.supabase.co',
      key: 'service',
    })
    expect(error).toBeNull()
    expect(keys.has(slotKey({ item: 'a', channel: 'gbp', date: '2026-10-20' }))).toBe(true)
  })

  it('ptDate is America/Los_Angeles', () => {
    expect(ptDate(new Date('2026-10-20T16:00:00Z'))).toBe('2026-10-20')
  })

  it('builds public URLs from platform responses', () => {
    expect(publicUrl('x-post-1', '{"data":{"id":"123"}}')).toBe('https://x.com/i/web/status/123')
    expect(publicUrl('gbp', '{"searchUrl":"https://g.page/r/example"}')).toBe('https://g.page/r/example')
  })

  it('GBP posts accept bare numeric account and location ids', () => {
    const link = 'https://ryan-realty.com/blog/t?utm_source=gbp&utm_medium=social&utm_campaign=t'
    const prefixed = buildRequest('gbp', `Body ${link} Ryan Realty LLC`, { link }, {
      GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID: 'accounts/109876549821',
      GOOGLE_BUSINESS_PROFILE_LOCATION_ID: 'locations/1234564753',
    })
    const bare = buildRequest('gbp', `Body ${link} Ryan Realty LLC`, { link }, {
      GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID: '109876549821',
      GOOGLE_BUSINESS_PROFILE_LOCATION_ID: '1234564753',
    })
    expect(bare.url).toBe('https://mybusiness.googleapis.com/v4/accounts/109876549821/locations/1234564753/localPosts')
    expect(bare.url).toBe(prefixed.url)
    expect(validateRequest('gbp', bare)).toEqual([])
  })

  it('gate-passing drafts are due without an approved flag', () => {
    const due = selectDue(
      [{ item: 'a', channel: 'gbp', scheduledAt: '2026-10-20T09:00:00-07:00', approved: false }],
      { today: '2026-10-20', catchUp: false, published: new Set() },
    )
    expect(due).toHaveLength(1)
  })
})
