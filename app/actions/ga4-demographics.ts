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
  BEND_METRO_CITIES,
  ga4ErrorMessage,
  isKnownBucket,
  sectionFromSettled,
  singleCount,
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
      /** Users in the Bend metro cities (BEND_METRO_CITIES, Oregon); null when that report failed. */
      bendMetroUsers:  number | null
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

  // Named reports, settled together: each section reads its own report by
  // name, so adding or removing one cannot shift another's response.
  const reports = {
    // Age bucket distribution (overall)
    age: client.runReport({
      property,
      dateRanges: range,
      dimensions: [{ name: 'userAgeBracket' }],
      metrics:    [{ name: 'totalUsers' }, { name: 'sessions' }],
      orderBys:   [{ dimension: { dimensionName: 'userAgeBracket' } }],
    }),
    // Gender split
    gender: client.runReport({
      property,
      dateRanges: range,
      dimensions: [{ name: 'userGender' }],
      metrics:    [{ name: 'totalUsers' }, { name: 'sessions' }],
    }),
    // Top cities (where are visitors physically located)
    cities: client.runReport({
      property,
      dateRanges: range,
      dimensions: [{ name: 'city' }, { name: 'region' }, { name: 'country' }],
      metrics:    [{ name: 'totalUsers' }, { name: 'sessions' }],
      orderBys:   [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 25,
    }),
    // Bend metro users, no dimensions: an exact count. Summing the top-25
    // city rows missed any metro city ranked below 25th.
    bendMetro: client.runReport({
      property,
      dateRanges: range,
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            { filter: { fieldName: 'region', stringFilter: { value: 'Oregon' } } },
            { filter: { fieldName: 'city', inListFilter: { values: [...BEND_METRO_CITIES] } } },
          ],
        },
      },
    }),
    // Age x channel — which channel drives each age? userAgeBracket is
    // incompatible with sessionSourceMedium; the default channel group is
    // the compatible session-scoped acquisition dimension.
    ageByChannel: client.runReport({
      property,
      dateRanges: range,
      dimensions: [{ name: 'userAgeBracket' }, { name: 'sessionDefaultChannelGroup' }],
      metrics:    [{ name: 'totalUsers' }, { name: 'sessions' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 60,
    }),
    // Seller LP visitors by city — where are HNW seller prospects coming from?
    sellerLpCities: client.runReport({
      property,
      dateRanges: range,
      dimensions: [{ name: 'city' }, { name: 'region' }],
      metrics:    [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: sellerLp,
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    }),
    // Seller LP visitors by age bracket — the killer report for HNW targeting
    sellerLpAge: client.runReport({
      property,
      dateRanges: range,
      dimensions: [{ name: 'userAgeBracket' }],
      metrics:    [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: sellerLp,
      orderBys: [{ dimension: { dimensionName: 'userAgeBracket' } }],
    }),
    // Seller LP visitors, no dimensions: an exact count that does not depend
    // on the age report Google may withhold.
    sellerLpTotals: client.runReport({
      property,
      dateRanges: range,
      metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: sellerLp,
    }),
    // Total users (for percentage calcs)
    totalUsers: client.runReport({
      property,
      dateRanges: range,
      metrics: [{ name: 'totalUsers' }],
    }),
  }
  type ReportName = keyof typeof reports
  const names = Object.keys(reports) as ReportName[]
  const outcomes = (await Promise.allSettled(names.map((n) => reports[n]))) as Settled[]
  const settled = Object.fromEntries(names.map((n, i) => [n, outcomes[i]])) as Record<ReportName, Settled>

  if (outcomes.every((o) => o.status === 'rejected')) {
    return { ok: false, error: ga4ErrorMessage((outcomes[0] as PromiseRejectedResult).reason) }
  }

  const ageBuckets = sectionFromSettled(
    settled.age,
    ([ageBracket = 'unknown'], [users = 0, sessions = 0]) => ({ ageBracket, users, sessions }),
    (r) => isKnownBucket(r.ageBracket),
  )
  const genders = sectionFromSettled(
    settled.gender,
    ([gender = 'unknown'], [users = 0, sessions = 0]) => ({ gender, users, sessions }),
    (r) => isKnownBucket(r.gender),
  )
  const topCities = sectionFromSettled(
    settled.cities,
    ([city = '(unknown)', region = '', country = ''], [users = 0, sessions = 0]) => ({ city, region, country, users, sessions }),
  )
  const ageByChannel = sectionFromSettled(
    settled.ageByChannel,
    ([ageBracket = 'unknown', channel = '(not set)'], [users = 0, sessions = 0]) => ({ ageBracket, channel, users, sessions }),
    (r) => isKnownBucket(r.ageBracket),
  )
  const sellerLpByCity = sectionFromSettled(
    settled.sellerLpCities,
    ([city = '(unknown)', region = ''], [users = 0, eventCount = 0]) => ({ city, region, users, eventCount }),
  )
  const sellerLpByAge = sectionFromSettled(
    settled.sellerLpAge,
    ([ageBracket = 'unknown'], [users = 0, eventCount = 0]) => ({ ageBracket, users, eventCount }),
    (r) => isKnownBucket(r.ageBracket),
  )
  const sellerLpTotals = sectionFromSettled(settled.sellerLpTotals, (_d, [users = 0, eventCount = 0]) => ({ users, eventCount }))
  const totalUsers = singleCount(sectionFromSettled(settled.totalUsers, (_d, [users = 0]) => users))
  const bendMetroUsers = singleCount(sectionFromSettled(settled.bendMetro, (_d, [users = 0]) => users))

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
    bendMetroUsers,
    complete: outcomes.every((o) => o.status === 'fulfilled'),
  }
}
