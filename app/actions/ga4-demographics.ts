/**
 * GA4 Data API — demographics queries.
 *
 * Requires Google Signals (ON, data/analytics/decisions.json `google-signals-on`).
 * Returns age bracket, gender and geography breakdowns plus an age x channel
 * cross-tab and the seller LP age and city splits.
 *
 * Used by /admin/analytics/demographics for the broker-facing "who is
 * visiting" report. Specifically tuned for the HNW elderly Bend seller
 * audience question: which age bracket views the seller LP, what cities
 * are they in, and from which channel.
 *
 * Each report is its own section (lib/analytics/ga4-demographic-sections.ts):
 * ok, withheld (Google's privacy thresholds removed every group), empty, or
 * error. One rejected report no longer fails the page. That was the
 * 2026-10-14 defect: the age x source report paired userAgeBracket with
 * sessionSourceMedium, which GA4 rejects as incompatible ("Please remove
 * userAgeBracket to make the request compatible"), and Promise.all turned
 * that one rejection into an error on every load. The cross-tab now uses
 * sessionDefaultChannelGroup, which GA4's checkCompatibility lists as
 * compatible with userAgeBracket (read 2026-10-14; sessionSourceMedium and
 * firstUserSourceMedium are not).
 *
 * Returns { ok: false, error } only when credentials are missing or every
 * report failed (an auth or quota failure).
 */
'use server'

import { BetaAnalyticsDataClient } from '@google-analytics/data'
import {
  ga4ErrorMessage,
  isKnownBucket,
  sectionFromSettled,
  type Ga4ReportLike,
  type Ga4Section,
} from '@/lib/analytics/ga4-demographic-sections'

export type AgeBucketRow    = { ageBracket: string; users: number; sessions: number }
export type GenderRow       = { gender: string; users: number; sessions: number }
export type GeoRow          = { city: string; region: string; country: string; users: number; sessions: number }
export type AgeByChannelRow = { ageBracket: string; channel: string; users: number; sessions: number }
export type SellerLPGeoRow  = { city: string; region: string; users: number; eventCount: number }
export type SellerLPAgeRow  = { ageBracket: string; users: number; eventCount: number }
export type SellerLPTotals  = { users: number; eventCount: number }

export type Ga4DemographicsResult =
  | {
      ok: true
      ageBuckets:      Ga4Section<AgeBucketRow>
      genders:         Ga4Section<GenderRow>
      topCities:       Ga4Section<GeoRow>
      ageByChannel:    Ga4Section<AgeByChannelRow>
      sellerLpByCity:  Ga4Section<SellerLPGeoRow>
      sellerLpByAge:   Ga4Section<SellerLPAgeRow>
      /** Seller LP visitors and visits, all ages and places (not thresholded). */
      sellerLpTotals:  Ga4Section<SellerLPTotals>
      /** All users in the range; null when that report failed. */
      totalUsers:      number | null
      /** False when any report failed; such a result is not cached. */
      complete:        boolean
    }
  | { ok: false; error: string }

type Settled = PromiseSettledResult<readonly [Ga4ReportLike, ...unknown[]]>

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
  const sellerLp = {
    andGroup: {
      expressions: [
        { filter: { fieldName: 'eventName', stringFilter: { value: 'view_landing_page' } } },
        { filter: { fieldName: 'customEvent:lp_variant', stringFilter: { value: 'seller-home-value' } } },
      ],
    },
  }

  const settled = (await Promise.allSettled([
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
    // 4. Age x channel — which channel drives each age? userAgeBracket is
    //    incompatible with sessionSourceMedium; the default channel group is
    //    the compatible session-scoped acquisition dimension.
    client.runReport({
      property,
      dateRanges: range,
      dimensions: [{ name: 'userAgeBracket' }, { name: 'sessionDefaultChannelGroup' }],
      metrics:    [{ name: 'totalUsers' }, { name: 'sessions' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 60,
    }),
    // 5. Seller LP visitors by city — where are HNW seller prospects coming from?
    client.runReport({
      property,
      dateRanges: range,
      dimensions: [{ name: 'city' }, { name: 'region' }],
      metrics:    [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: sellerLp,
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    }),
    // 6. Seller LP visitors by age bracket — the killer report for HNW targeting
    client.runReport({
      property,
      dateRanges: range,
      dimensions: [{ name: 'userAgeBracket' }],
      metrics:    [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: sellerLp,
      orderBys: [{ dimension: { dimensionName: 'userAgeBracket' } }],
    }),
    // 7. Total users (for percentage calcs)
    client.runReport({
      property,
      dateRanges: range,
      metrics: [{ name: 'totalUsers' }],
    }),
    // 8. Seller LP visitors, no dimensions: an exact count that does not
    //    depend on the age report Google may withhold.
    client.runReport({
      property,
      dateRanges: range,
      metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: sellerLp,
    }),
  ])) as Settled[]

  if (settled.every((s) => s.status === 'rejected')) {
    return { ok: false, error: ga4ErrorMessage((settled[0] as PromiseRejectedResult).reason) }
  }

  const [ageRes, genderRes, geoRes, ageByChannelRes, sellerLpGeoRes, sellerLpAgeRes, totalUsersRes, sellerLpTotalsRes] = settled

  const ageBuckets = sectionFromSettled(
    ageRes,
    ([ageBracket = 'unknown'], [users = 0, sessions = 0]) => ({ ageBracket, users, sessions }),
    (r) => isKnownBucket(r.ageBracket),
  )
  const genders = sectionFromSettled(
    genderRes,
    ([gender = 'unknown'], [users = 0, sessions = 0]) => ({ gender, users, sessions }),
    (r) => isKnownBucket(r.gender),
  )
  const topCities = sectionFromSettled(
    geoRes,
    ([city = '(unknown)', region = '', country = ''], [users = 0, sessions = 0]) => ({ city, region, country, users, sessions }),
  )
  const ageByChannel = sectionFromSettled(
    ageByChannelRes,
    ([ageBracket = 'unknown', channel = '(not set)'], [users = 0, sessions = 0]) => ({ ageBracket, channel, users, sessions }),
    (r) => isKnownBucket(r.ageBracket),
  )
  const sellerLpByCity = sectionFromSettled(
    sellerLpGeoRes,
    ([city = '(unknown)', region = ''], [users = 0, eventCount = 0]) => ({ city, region, users, eventCount }),
  )
  const sellerLpByAge = sectionFromSettled(
    sellerLpAgeRes,
    ([ageBracket = 'unknown'], [users = 0, eventCount = 0]) => ({ ageBracket, users, eventCount }),
    (r) => isKnownBucket(r.ageBracket),
  )
  const sellerLpTotals = sectionFromSettled(sellerLpTotalsRes, (_d, [users = 0, eventCount = 0]) => ({ users, eventCount }))
  const total = sectionFromSettled(totalUsersRes, (_d, [users = 0]) => users)
  // No rows without thresholding means no users; withheld or failed means unknown.
  const totalUsers = total.state === 'ok' ? (total.rows[0] ?? 0) : total.state === 'empty' ? 0 : null

  return {
    ok: true,
    ageBuckets,
    genders,
    topCities,
    ageByChannel,
    sellerLpByCity,
    sellerLpByAge,
    sellerLpTotals,
    totalUsers,
    complete: settled.every((s) => s.status === 'fulfilled'),
  }
}
