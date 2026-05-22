/**
 * GA4 Data API — demographics queries.
 *
 * Requires Google Signals (already enabled). Returns age bracket, gender,
 * geography breakdowns plus cross-tabs by page category and traffic source.
 *
 * Used by /admin/analytics/demographics for the broker-facing "who is
 * visiting" report. Specifically tuned for the HNW elderly Bend seller
 * audience question: which age bracket views the seller LP, what cities
 * are they in, and from which channel.
 *
 * Falls back to { ok: false, error } when credentials are missing or the
 * API call fails — callers should render a friendly empty state.
 */
'use server'

import { BetaAnalyticsDataClient } from '@google-analytics/data'

export type AgeBucketRow   = { ageBracket: string; users: number; sessions: number }
export type GenderRow      = { gender: string; users: number; sessions: number }
export type GeoRow         = { city: string; region: string; country: string; users: number; sessions: number }
export type AgeByPageRow   = { ageBracket: string; pagePath: string; users: number; pageViews: number }
export type AgeBySourceRow = { ageBracket: string; sourceMedium: string; users: number; sessions: number }
export type SellerLPGeoRow = { city: string; region: string; users: number; eventCount: number }
export type SellerLPAgeRow = { ageBracket: string; users: number; eventCount: number }

export type Ga4DemographicsResult =
  | {
      ok: true
      ageBuckets:      AgeBucketRow[]
      genders:         GenderRow[]
      topCities:       GeoRow[]
      ageByPage:       AgeByPageRow[]
      ageBySource:     AgeBySourceRow[]
      sellerLpByCity:  SellerLPGeoRow[]
      sellerLpByAge:   SellerLPAgeRow[]
      totalUsers:      number
    }
  | { ok: false; error: string }

function num(v: string | null | undefined): number {
  if (!v) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function getGA4Demographics(
  startDate: string,
  endDate: string,
): Promise<Ga4DemographicsResult> {
  const propertyId  = process.env.GOOGLE_GA4_PROPERTY_ID?.trim()
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKey  = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  if (!propertyId || !clientEmail || !privateKey) {
    return { ok: false, error: 'GA4_NOT_CONFIGURED' }
  }

  const client = new BetaAnalyticsDataClient({
    credentials: { client_email: clientEmail, private_key: privateKey.replace(/\\n/g, '\n') },
  })
  const property = `properties/${propertyId}`
  const range = [{ startDate, endDate }]

  try {
    const [
      ageRes,
      genderRes,
      geoRes,
      ageByPageRes,
      ageBySourceRes,
      sellerLpGeoRes,
      sellerLpAgeRes,
      totalUsersRes,
    ] = await Promise.all([
      // 1. Age bucket distribution (overall)
      client.runReport({
        property,
        dateRanges: range,
        dimensions: [{ name: 'userAgeBracket' }],
        metrics:    [{ name: 'totalUsers' }, { name: 'sessions' }],
        orderBys:   [{ dimension: { dimensionName: 'userAgeBracket' } }],
      }),
      // 2. Gender split
      client.runReport({
        property,
        dateRanges: range,
        dimensions: [{ name: 'userGender' }],
        metrics:    [{ name: 'totalUsers' }, { name: 'sessions' }],
      }),
      // 3. Top cities (where are visitors physically located)
      client.runReport({
        property,
        dateRanges: range,
        dimensions: [{ name: 'city' }, { name: 'region' }, { name: 'country' }],
        metrics:    [{ name: 'totalUsers' }, { name: 'sessions' }],
        orderBys:   [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 25,
      }),
      // 4. Age x Page cross-tab — what does each age bracket actually look at?
      client.runReport({
        property,
        dateRanges: range,
        dimensions: [{ name: 'userAgeBracket' }, { name: 'pagePath' }],
        metrics:    [{ name: 'totalUsers' }, { name: 'screenPageViews' }],
        orderBys:   [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 100,  // ~6 brackets x top pages
      }),
      // 5. Age x Source/medium — which channel drives each age?
      client.runReport({
        property,
        dateRanges: range,
        dimensions: [{ name: 'userAgeBracket' }, { name: 'sessionSourceMedium' }],
        metrics:    [{ name: 'totalUsers' }, { name: 'sessions' }],
        orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 60,
      }),
      // 6. Seller LP visitors by city — where are HNW seller prospects coming from?
      client.runReport({
        property,
        dateRanges: range,
        dimensions: [{ name: 'city' }, { name: 'region' }],
        metrics:    [{ name: 'totalUsers' }, { name: 'eventCount' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { filter: { fieldName: 'eventName', stringFilter: { value: 'view_landing_page' } } },
              { filter: { fieldName: 'customEvent:lp_variant', stringFilter: { value: 'seller-home-value' } } },
            ],
          },
        },
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 20,
      }),
      // 7. Seller LP visitors by age bracket — the killer report for HNW targeting
      client.runReport({
        property,
        dateRanges: range,
        dimensions: [{ name: 'userAgeBracket' }],
        metrics:    [{ name: 'totalUsers' }, { name: 'eventCount' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { filter: { fieldName: 'eventName', stringFilter: { value: 'view_landing_page' } } },
              { filter: { fieldName: 'customEvent:lp_variant', stringFilter: { value: 'seller-home-value' } } },
            ],
          },
        },
        orderBys: [{ dimension: { dimensionName: 'userAgeBracket' } }],
      }),
      // 8. Total users (for percentage calcs)
      client.runReport({
        property,
        dateRanges: range,
        metrics: [{ name: 'totalUsers' }],
      }),
    ])

    const mapAgeBuckets    = (ageRes[0].rows ?? []).map((r) => ({
      ageBracket: r.dimensionValues?.[0]?.value ?? 'unknown',
      users:      num(r.metricValues?.[0]?.value),
      sessions:   num(r.metricValues?.[1]?.value),
    }))
    const mapGenders       = (genderRes[0].rows ?? []).map((r) => ({
      gender:   r.dimensionValues?.[0]?.value ?? 'unknown',
      users:    num(r.metricValues?.[0]?.value),
      sessions: num(r.metricValues?.[1]?.value),
    }))
    const mapTopCities     = (geoRes[0].rows ?? []).map((r) => ({
      city:    r.dimensionValues?.[0]?.value ?? '(unknown)',
      region:  r.dimensionValues?.[1]?.value ?? '',
      country: r.dimensionValues?.[2]?.value ?? '',
      users:    num(r.metricValues?.[0]?.value),
      sessions: num(r.metricValues?.[1]?.value),
    }))
    const mapAgeByPage     = (ageByPageRes[0].rows ?? []).map((r) => ({
      ageBracket: r.dimensionValues?.[0]?.value ?? 'unknown',
      pagePath:   r.dimensionValues?.[1]?.value ?? '(none)',
      users:      num(r.metricValues?.[0]?.value),
      pageViews:  num(r.metricValues?.[1]?.value),
    }))
    const mapAgeBySource   = (ageBySourceRes[0].rows ?? []).map((r) => ({
      ageBracket:   r.dimensionValues?.[0]?.value ?? 'unknown',
      sourceMedium: r.dimensionValues?.[1]?.value ?? '(direct)',
      users:        num(r.metricValues?.[0]?.value),
      sessions:     num(r.metricValues?.[1]?.value),
    }))
    const mapSellerLpGeo   = (sellerLpGeoRes[0].rows ?? []).map((r) => ({
      city:       r.dimensionValues?.[0]?.value ?? '(unknown)',
      region:     r.dimensionValues?.[1]?.value ?? '',
      users:      num(r.metricValues?.[0]?.value),
      eventCount: num(r.metricValues?.[1]?.value),
    }))
    const mapSellerLpAge   = (sellerLpAgeRes[0].rows ?? []).map((r) => ({
      ageBracket: r.dimensionValues?.[0]?.value ?? 'unknown',
      users:      num(r.metricValues?.[0]?.value),
      eventCount: num(r.metricValues?.[1]?.value),
    }))
    const totalUsers       = num(totalUsersRes[0].rows?.[0]?.metricValues?.[0]?.value)

    return {
      ok: true,
      ageBuckets: mapAgeBuckets,
      genders: mapGenders,
      topCities: mapTopCities,
      ageByPage: mapAgeByPage,
      ageBySource: mapAgeBySource,
      sellerLpByCity: mapSellerLpGeo,
      sellerLpByAge: mapSellerLpAge,
      totalUsers,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
