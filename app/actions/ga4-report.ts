'use server'

import { BetaAnalyticsDataClient } from '@google-analytics/data'

const LEAD_EVENT_NAMES = [
  'generate_lead',
  'contact_agent',
  'contact_agent_click',
  'schedule_tour_click',
  'tour_requested',
  'valuation_requested',
  'cma_downloaded',
  'sign_up',
  'newsletter_signup',
] as const

export type GA4Summary = {
  sessions: number
  totalUsers: number
  newUsers: number
  averageSessionDurationSeconds: number
  engagementRate: number
  bounceRate: number
  topSources: {
    sourceMedium: string
    sessions: number
    users: number
    engagedSessions: number
    engagementRate: number
  }[]
  topPages: {
    pagePath: string
    pageTitle: string
    views: number
    users: number
    avgEngagementTimeSeconds: number
  }[]
  totalLeadEvents: number
  leadEventRate: number
  topLeadEvents: {
    eventName: string
    eventCount: number
    users: number
  }[]
  leadSources: {
    sourceMedium: string
    leadEvents: number
    users: number
  }[]
  socialChannels: {
    channel: string
    sessions: number
    users: number
    engagementRate: number
  }[]
}

export type GA4ReportResult = { ok: true; data: GA4Summary } | { ok: false; error: string }

/**
 * Fetch basic GA4 metrics for the dashboard. Requires:
 * - GOOGLE_GA4_PROPERTY_ID (numeric property ID from GA4 Admin → Property settings)
 * - GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
 * - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (with \n as literal backslash-n in env)
 */
export async function getGA4Summary(
  startDate: string,
  endDate: string
): Promise<GA4ReportResult> {
  const propertyId = process.env.GOOGLE_GA4_PROPERTY_ID?.trim()
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()

  if (!propertyId || !clientEmail || !privateKey) {
    return { ok: false, error: 'GA4_NOT_CONFIGURED' }
  }

  const key = privateKey.replace(/\\n/g, '\n')

  try {
    const client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: key,
      },
    })

    const [summaryResponse, sourceResponse, pageResponse, leadEventsResponse, leadSourcesResponse, socialChannelsResponse] = await Promise.all([
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'averageSessionDuration' },
          { name: 'engagementRate' },
          { name: 'bounceRate' },
        ],
      }),
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'engagedSessions' },
          { name: 'engagementRate' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'userEngagementDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }),
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [
          { name: 'eventCount' },
          { name: 'totalUsers' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: [...LEAD_EVENT_NAMES],
              caseSensitive: false,
            },
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 10,
      }),
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [
          { name: 'eventCount' },
          { name: 'totalUsers' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: [...LEAD_EVENT_NAMES],
              caseSensitive: false,
            },
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 10,
      }),
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'engagementRate' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      }),
    ])

    const summary = summaryResponse[0]
    const sourceBreakdown = sourceResponse[0]
    const pageBreakdown = pageResponse[0]
    const leadEventsBreakdown = leadEventsResponse[0]
    const leadSourcesBreakdown = leadSourcesResponse[0]
    const socialChannelsBreakdown = socialChannelsResponse[0]

    const row = summary.rows?.[0]
    if (!row || !row.metricValues?.length) {
      return {
        ok: true,
        data: {
          sessions: 0,
          totalUsers: 0,
          newUsers: 0,
          averageSessionDurationSeconds: 0,
          engagementRate: 0,
          bounceRate: 0,
          topSources: [],
          topPages: [],
          totalLeadEvents: 0,
          leadEventRate: 0,
          topLeadEvents: [],
          leadSources: [],
          socialChannels: [],
        },
      }
    }

    const vals = row.metricValues
    const topSources = (sourceBreakdown.rows ?? []).map((r) => {
      const sourceMedium = String(r.dimensionValues?.[0]?.value || '(direct) / (none)')
      const sessions = parseInt(String(r.metricValues?.[0]?.value ?? 0), 10)
      const users = parseInt(String(r.metricValues?.[1]?.value ?? 0), 10)
      const engagedSessions = parseInt(String(r.metricValues?.[2]?.value ?? 0), 10)
      const engagementRate = parseFloat(String(r.metricValues?.[3]?.value ?? 0))
      return { sourceMedium, sessions, users, engagedSessions, engagementRate }
    })

    const topPages = (pageBreakdown.rows ?? []).map((r) => {
      const pagePath = String(r.dimensionValues?.[0]?.value || '/')
      const pageTitle = String(r.dimensionValues?.[1]?.value || '(untitled)')
      const views = parseInt(String(r.metricValues?.[0]?.value ?? 0), 10)
      const users = parseInt(String(r.metricValues?.[1]?.value ?? 0), 10)
      const totalEngagement = parseFloat(String(r.metricValues?.[2]?.value ?? 0))
      const avgEngagementTimeSeconds = users > 0 ? totalEngagement / users : 0
      return { pagePath, pageTitle, views, users, avgEngagementTimeSeconds }
    })

    const topLeadEvents = (leadEventsBreakdown.rows ?? []).map((r) => {
      const eventName = String(r.dimensionValues?.[0]?.value || '(unknown)')
      const eventCount = parseInt(String(r.metricValues?.[0]?.value ?? 0), 10)
      const users = parseInt(String(r.metricValues?.[1]?.value ?? 0), 10)
      return { eventName, eventCount, users }
    })

    const leadSources = (leadSourcesBreakdown.rows ?? []).map((r) => {
      const sourceMedium = String(r.dimensionValues?.[0]?.value || '(direct) / (none)')
      const leadEvents = parseInt(String(r.metricValues?.[0]?.value ?? 0), 10)
      const users = parseInt(String(r.metricValues?.[1]?.value ?? 0), 10)
      return { sourceMedium, leadEvents, users }
    })

    const socialChannels = (socialChannelsBreakdown.rows ?? [])
      .map((r) => {
        const channel = String(r.dimensionValues?.[0]?.value || '(unknown)')
        const sessions = parseInt(String(r.metricValues?.[0]?.value ?? 0), 10)
        const users = parseInt(String(r.metricValues?.[1]?.value ?? 0), 10)
        const engagementRate = parseFloat(String(r.metricValues?.[2]?.value ?? 0))
        return { channel, sessions, users, engagementRate }
      })
      .filter((r) => /social/i.test(r.channel))

    const totalLeadEvents = topLeadEvents.reduce((sum, row) => sum + row.eventCount, 0)
    const sessions = parseInt(String(vals[0]?.value ?? 0), 10)
    const leadEventRate = sessions > 0 ? totalLeadEvents / sessions : 0

    return {
      ok: true,
      data: {
        sessions,
        totalUsers: parseInt(String(vals[1]?.value ?? 0), 10),
        newUsers: parseInt(String(vals[2]?.value ?? 0), 10),
        averageSessionDurationSeconds: parseFloat(String(vals[3]?.value ?? 0)),
        engagementRate: parseFloat(String(vals[4]?.value ?? 0)),
        bounceRate: parseFloat(String(vals[5]?.value ?? 0)),
        topSources,
        topPages,
        totalLeadEvents,
        leadEventRate,
        topLeadEvents,
        leadSources,
        socialChannels,
      },
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
}
