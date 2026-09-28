import { describe, expect, it, vi } from 'vitest'
import { buildEmailVisitTimelineRow, recordEmailVisitTimeline } from './email-visit-timeline'

const SESSION = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const SELL = 'https://ryan-realty.com/sell?utm_source=cma&utm_medium=email&utm_campaign=cma-zz-postland-20260928&agent=matt'

describe('buildEmailVisitTimelineRow', () => {
  it('writes Visited /sell from CMA email with the per-(session, campaign, path) key', () => {
    const row = buildEmailVisitTimelineRow({
      eventType: 'page_view',
      sessionId: SESSION,
      pageUrl: SELL,
      utmMedium: 'email',
      utmSource: 'cma',
      utmCampaign: 'cma-zz-postland-20260928',
      personId: 88,
      tokenVerified: true,
    })
    expect(row).toMatchObject({
      person_id: 88,
      kind: 'web_event',
      source: 'email-visit',
      title: 'Visited /sell from CMA email',
      body: null,
      dedupe_key: `track:email-visit:${SESSION}:cma-zz-postland-20260928:/sell`,
    })
    expect(row?.payload.emailKey).toBe('cma:cma-zz-postland-20260928')
    expect(row?.payload.path).toBe('/sell')
    expect(row?.payload.pageUrl).not.toContain('_pid')
  })

  it('writes nothing for a cookie-only identification', () => {
    expect(
      buildEmailVisitTimelineRow({
        eventType: 'page_view',
        sessionId: SESSION,
        pageUrl: SELL,
        utmMedium: 'email',
        utmSource: 'cma',
        utmCampaign: 'cma-zz-postland-20260928',
        personId: 88,
        tokenVerified: false,
      }),
    ).toBeNull()
  })

  it('writes nothing when utm_medium is not email', () => {
    expect(
      buildEmailVisitTimelineRow({
        eventType: 'page_view',
        sessionId: SESSION,
        pageUrl: 'https://ryan-realty.com/sell?utm_medium=document&utm_source=cma',
        utmMedium: 'document',
        utmSource: 'cma',
        utmCampaign: 'cma-zz-postland-20260928',
        personId: 88,
        tokenVerified: true,
      }),
    ).toBeNull()
  })

  it('a second view of the same landing reuses the same dedupe key (a no-op upsert)', () => {
    const first = buildEmailVisitTimelineRow({
      eventType: 'page_view',
      sessionId: SESSION,
      pageUrl: SELL,
      utmMedium: 'email',
      utmSource: 'cma',
      utmCampaign: 'cma-zz-postland-20260928',
      personId: 88,
      tokenVerified: true,
    })
    const second = buildEmailVisitTimelineRow({
      eventType: 'page_view',
      sessionId: SESSION,
      pageUrl: SELL,
      utmMedium: 'email',
      utmSource: 'cma',
      utmCampaign: 'cma-zz-postland-20260928',
      personId: 88,
      tokenVerified: true,
    })
    expect(first?.dedupe_key).toBe(second?.dedupe_key)
  })

  it('/reviews in the same session gets its own row', () => {
    const sell = buildEmailVisitTimelineRow({
      eventType: 'page_view',
      sessionId: SESSION,
      pageUrl: SELL,
      utmMedium: 'email',
      utmSource: 'cma',
      utmCampaign: 'cma-zz-postland-20260928',
      personId: 88,
      tokenVerified: true,
    })
    const reviews = buildEmailVisitTimelineRow({
      eventType: 'page_view',
      sessionId: SESSION,
      pageUrl:
        'https://ryan-realty.com/reviews?utm_source=cma&utm_medium=email&utm_campaign=cma-zz-postland-20260928',
      utmMedium: 'email',
      utmSource: 'cma',
      utmCampaign: 'cma-zz-postland-20260928',
      personId: 88,
      tokenVerified: true,
    })
    expect(reviews?.title).toBe('Visited /reviews from CMA email')
    expect(reviews?.dedupe_key).not.toBe(sell?.dedupe_key)
    expect(reviews?.dedupe_key).toBe(`track:email-visit:${SESSION}:cma-zz-postland-20260928:/reviews`)
  })

  it('skips automated sessions and /admin or /api paths', () => {
    expect(
      buildEmailVisitTimelineRow({
        eventType: 'page_view',
        sessionId: SESSION,
        pageUrl: SELL,
        utmMedium: 'email',
        personId: 88,
        tokenVerified: true,
        automated: true,
      }),
    ).toBeNull()
    expect(
      buildEmailVisitTimelineRow({
        eventType: 'page_view',
        sessionId: SESSION,
        pageUrl: 'https://ryan-realty.com/admin/people/1?utm_medium=email',
        utmMedium: 'email',
        personId: 88,
        tokenVerified: true,
      }),
    ).toBeNull()
    expect(
      buildEmailVisitTimelineRow({
        eventType: 'page_view',
        sessionId: SESSION,
        pageUrl: 'https://ryan-realty.com/api/track/e/click?utm_medium=email',
        utmMedium: 'email',
        personId: 88,
        tokenVerified: true,
      }),
    ).toBeNull()
  })

  it('a /cma arrival with email tags writes Visited /cma/<slug> from CMA email', () => {
    const row = buildEmailVisitTimelineRow({
      eventType: 'page_view',
      sessionId: SESSION,
      pageUrl:
        'https://ryan-realty.com/cma/cma-zz-postland-20260928?utm_source=cma&utm_medium=email&utm_campaign=cma-zz-postland-20260928&agent=matt',
      utmMedium: null,
      utmSource: null,
      utmCampaign: null,
      personId: 13168,
      tokenVerified: true,
    })
    expect(row?.title).toBe('Visited /cma/cma-zz-postland-20260928 from CMA email')
    expect(row?.payload.path).toBe('/cma/cma-zz-postland-20260928')
  })

  it('the sell landing title uses the path without from=cma', () => {
    const row = buildEmailVisitTimelineRow({
      eventType: 'page_view',
      sessionId: SESSION,
      pageUrl:
        'https://ryan-realty.com/sell?from=cma&utm_source=cma&utm_medium=email&utm_campaign=cma-zz-postland-20260928&agent=matt',
      utmMedium: 'email',
      utmSource: 'cma',
      utmCampaign: 'cma-zz-postland-20260928',
      personId: 13168,
      tokenVerified: true,
    })
    expect(row?.title).toBe('Visited /sell from CMA email')
    expect(row?.payload.path).toBe('/sell')
  })

  it('labels a non-CMA email visit as from email', () => {
    const row = buildEmailVisitTimelineRow({
      eventType: 'page_view',
      sessionId: SESSION,
      pageUrl: 'https://ryan-realty.com/sell?utm_medium=email&utm_source=newsletter&utm_campaign=june',
      utmMedium: 'email',
      utmSource: 'newsletter',
      utmCampaign: 'june',
      personId: 88,
      tokenVerified: true,
    })
    expect(row?.title).toBe('Visited /sell from email')
    expect(row?.payload.emailKey).toBeUndefined()
  })
})

describe('recordEmailVisitTimeline', () => {
  it('upserts ignoreDuplicates and swallows a write failure', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const sb = { from: vi.fn(() => ({ upsert })) }
    const row = buildEmailVisitTimelineRow({
      eventType: 'page_view',
      sessionId: SESSION,
      pageUrl: SELL,
      utmMedium: 'email',
      utmSource: 'cma',
      utmCampaign: 'cma-zz-postland-20260928',
      personId: 88,
      tokenVerified: true,
    })
    expect(row).not.toBeNull()
    await recordEmailVisitTimeline(sb, row!)
    expect(sb.from).toHaveBeenCalledWith('crm_timeline')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'web_event', source: 'email-visit' }),
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )

    upsert.mockRejectedValueOnce(new Error('db down'))
    await expect(recordEmailVisitTimeline(sb, row!)).resolves.toBeUndefined()
  })
})
