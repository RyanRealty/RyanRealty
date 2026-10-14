#!/usr/bin/env node
/**
 * GA4 Admin API config — audit + apply.
 *
 * Modes:
 *   node scripts/ga4-admin.mjs audit            → list current config, write to out/ga4-audit.json
 *   node scripts/ga4-admin.mjs apply            → apply the locked config below (idempotent)
 *   node scripts/ga4-admin.mjs apply-audiences  → the audience step only: create missing
 *                                                 audiences and rebuild REBUILT_AUDIENCES.
 *                                                 Touches no key event or dimension.
 *   node scripts/ga4-admin.mjs apply-audiences --dry-run
 *                                               → reads the live audiences and prints what
 *                                                 the step WOULD rename and create (each
 *                                                 request body), changing nothing.
 *   ... apply-audiences --group=visitor-intent  → only the audiences in that group (the
 *                                                 buyer / seller / visitor-intent set, Matt
 *                                                 2026-10-14). Combine with --dry-run.
 *
 * Auth: reuses GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *       from .env.local, else from the process environment (a cloud session).
 *       Adds analytics.edit scope so we can mutate config.
 *
 * Locked config:
 *   - 4 conversion events (generate_lead, call_initiated, tour_requested,
 *     cma_anchor_click)
 *   - 9 custom event-scoped dimensions (lp_variant, lp_source, lp_medium,
 *     lp_campaign, lp_content, broker, lead_classification, lead_type)
 *   - 2 custom user-scoped dimensions (assigned_broker, lead_status)
 *   - 5 audiences (form_starters_no_submit, lp_visitors_7d, lp_visitors_30d,
 *     repeat_visitors, high_intent_sellers)
 *
 * Idempotent: each item has a unique displayName + parameterName / scope tuple
 * that we match against before creating. Running apply twice produces no dupes.
 *
 * Reference: https://developers.google.com/analytics/devguides/config/admin/v1
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { google } from 'googleapis'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = join(__dirname, '..')

// ──────────────────────────────────────────────────────────────────────────
// Env loading (no dotenv dep — just parse .env.local)
// ──────────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = join(REPO_ROOT, '.env.local')
  // A cloud session has the variables in its environment and no .env.local.
  if (!existsSync(envPath)) return { ...process.env }
  const text = readFileSync(envPath, 'utf8')
  const env = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const env = loadEnv()
const PROPERTY_ID = env.GOOGLE_GA4_PROPERTY_ID?.trim()
const CLIENT_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
const PRIVATE_KEY = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
const SUBJECT = env.GOOGLE_SERVICE_ACCOUNT_SUBJECT?.trim()

if (!PROPERTY_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error('FATAL: missing GOOGLE_GA4_PROPERTY_ID, GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  process.exit(1)
}

// ──────────────────────────────────────────────────────────────────────────
// Locked configuration
// ──────────────────────────────────────────────────────────────────────────

/**
 * Events that should be marked as conversions (key events in GA4 vocab). `apply`
 * only adds, so this list must never name an event the property has stopped
 * marking, or a run would undo that call. valuation_requested stays a step event
 * beside the one generate_lead per submit (docs/ANALYTICS_LEAD_TRACKING.md) and
 * contact_agent has no sender; both were listed here until 2026-10-14. So was
 * listing_showing_click, which the property stopped marking between 04:00 and
 * 05:05 UTC that day (with home_valuation_cta_click, listing_inquiry and
 * schedule_showing), a change made outside this script.
 */
const CONVERSION_EVENTS = [
  { name: 'generate_lead',         purpose: 'primary seller lead conversion' },
  { name: 'call_initiated',        purpose: 'tel: link click' },
  { name: 'tour_requested',        purpose: 'buyer tour request' },
  { name: 'cma_anchor_click',      purpose: 'CMA section interaction' },
]

/**
 * Custom dimensions. scope = EVENT or USER. parameterName matches the GA4 param.
 *
 * Idempotency note: GA4 dedupes on (parameterName, scope). Existing dimensions
 * already on the property (audited 2026-05-21):
 *   lp_variant (EVENT), lp_source (EVENT), lp_campaign (EVENT),
 *   broker_slug (EVENT) — reused here as `broker`.
 *
 * We KEEP `broker_slug` as the parameter name to avoid creating a duplicate
 * dimension; the dashboard queries against `customEvent:broker_slug`.
 */
const CUSTOM_DIMENSIONS = [
  // Event-scoped (already-present items are no-ops at apply time)
  { parameterName: 'lp_variant',          displayName: 'LP Variant',          description: 'Landing page variant slug (seller-home-value, tetherow, etc.)',     scope: 'EVENT' },
  { parameterName: 'lp_source',           displayName: 'LP Source',           description: 'utm_source captured from URL on LP view',                            scope: 'EVENT' },
  { parameterName: 'lp_medium',           displayName: 'LP Medium',           description: 'utm_medium captured from URL on LP view',                            scope: 'EVENT' },
  { parameterName: 'lp_campaign',         displayName: 'LP Campaign',         description: 'utm_campaign captured from URL on LP view',                          scope: 'EVENT' },
  { parameterName: 'lp_content',          displayName: 'LP Content',          description: 'utm_content (ad creative id) captured from URL on LP view',          scope: 'EVENT' },
  { parameterName: 'broker_slug',         displayName: 'Broker Slug',         description: 'Assigned broker slug (matt-ryan / paul-stevenson / rebecca-peterson)', scope: 'EVENT' },
  { parameterName: 'lead_classification', displayName: 'Lead Classification', description: 'Timeline-based tier (hot / warm / nurture)',                         scope: 'EVENT' },
  { parameterName: 'lead_type',           displayName: 'Lead Type',           description: 'seller or buyer',                                                    scope: 'EVENT' },
  { parameterName: 'page_type',           displayName: 'Page Type',           description: 'Shared URL taxonomy from lib/analytics/page-type.ts',                 scope: 'EVENT' },
  // User-scoped
  { parameterName: 'assigned_broker',     displayName: 'Assigned Broker',     description: 'First broker assigned to this user — stable user property',          scope: 'USER' },
  { parameterName: 'lead_status',         displayName: 'Lead Status',         description: 'Current CRM pipeline status — synced as a user property',            scope: 'USER' },
]

/**
 * Audiences. Each has a `displayName`, `description`, and a `filterClauses`
 * array of GA4 audience filter expressions. We match by displayName.
 *
 * Membership durations:
 *   - 7-day audiences: membershipDurationDays = 7
 *   - 30-day audiences: membershipDurationDays = 30
 *   - long-term: membershipDurationDays = 540 (GA4 max)
 */
const AUDIENCES = [
  {
    displayName: 'Form starters — no submit',
    description: 'Users who fired form_start but never fired generate_lead. Retargeting pool.',
    membershipDurationDays: 30,
    filterClauses: [
      {
        clauseType: 'INCLUDE',
        simpleFilter: {
          scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
          filterExpression: {
            dimensionOrMetricFilter: {
              fieldName: 'eventCount',
              atAnyPointInTime: false,
              numericFilter: {
                operation: 'GREATER_THAN',
                value: { int64Value: '0' },
              },
            },
            // Restrict by event_name = form_start using an event filter wrapper
          },
        },
      },
      {
        clauseType: 'EXCLUDE',
        simpleFilter: {
          scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
          filterExpression: {
            dimensionOrMetricFilter: {
              fieldName: 'eventCount',
              atAnyPointInTime: false,
              numericFilter: {
                operation: 'GREATER_THAN',
                value: { int64Value: '0' },
              },
            },
          },
        },
      },
    ],
    // We use simplified eventFilter-based clauses via the SDK; see buildAudiencePayload below.
    spec: {
      kind: 'form_starters_no_submit',
    },
  },
  {
    displayName: 'LP visitors 7d — no conversion',
    description: 'Viewed any LP last 7 days, no generate_lead.',
    membershipDurationDays: 7,
    spec: { kind: 'lp_visitors_7d' },
  },
  {
    displayName: 'LP visitors 30d — no conversion',
    description: 'Viewed any LP last 30 days, no generate_lead.',
    membershipDurationDays: 30,
    spec: { kind: 'lp_visitors_30d' },
  },
  {
    displayName: 'Repeat visitors — no conversion',
    description: '3+ sessions, no generate_lead.',
    membershipDurationDays: 540,
    spec: { kind: 'repeat_visitors' },
  },
  {
    displayName: 'High-intent sellers',
    // GA4 caps an audience description at 100 characters.
    description: 'Scrolled 75%+ of a /sell landing page: scroll_depth with page_type sell, depth over 74. 30 days.',
    membershipDurationDays: 30,
    spec: { kind: 'high_intent_sellers' },
  },
  {
    displayName: 'Facebook visitors',
    description: 'First user source contains facebook or instagram. Everyone who first arrived from Meta.',
    membershipDurationDays: 540,
    spec: { kind: 'facebook_visitors' },
  },
  {
    displayName: 'Google visitors',
    description: 'First user source contains google. Anyone whose first arrival was from Google.',
    membershipDurationDays: 540,
    spec: { kind: 'google_visitors' },
  },
  {
    displayName: 'Returning visitors',
    description: '2+ sessions (session_start fired more than once). Repeat visitors regardless of conversion.',
    membershipDurationDays: 540,
    spec: { kind: 'returning_visitors' },
  },
  {
    displayName: 'Identified Facebook leads',
    description: 'Has a CRM person id AND first arrived from facebook or instagram. Named leads from Meta.',
    membershipDurationDays: 540,
    spec: { kind: 'identified_facebook_leads' },
  },
  {
    displayName: 'Identified Google leads',
    description: 'Has a CRM person id AND first arrived from google. Named leads from Google.',
    membershipDurationDays: 540,
    spec: { kind: 'identified_google_leads' },
  },
  {
    displayName: 'Real site traffic',
    description: 'Hostname is one of our domains. Apply as a Comparison to strip ghost / referral spam.',
    membershipDurationDays: 540,
    spec: { kind: 'real_site_traffic' },
  },

  // ── Buyers and sellers (Matt 2026-10-14) ────────────────────────────────────
  // BEHAVIOR ONLY, for fair housing: these audiences can feed housing ads, so
  // none may use age, gender, interests, ZIP, city or any other geography or
  // demographic condition. Only events this site sends and the visitor_intent
  // user property (itself built only from pages and actions:
  // lib/analytics/visitor-intent.ts). FAIR_HOUSING_BANNED_FIELDS below fails the
  // payload builder if a condition here ever names one.
  {
    displayName: 'Buyers - active',
    description: 'Behavior only: 3+ view_listing in 30 days, or save_listing. No demographic or place terms.',
    membershipDurationDays: 30,
    group: 'visitor-intent',
    spec: { kind: 'buyers_active' },
  },
  {
    displayName: 'Buyers - hot',
    description: 'Behavior only: schedule_tour_click, ask_question_click or call_initiated in 30 days.',
    membershipDurationDays: 30,
    group: 'visitor-intent',
    spec: { kind: 'buyers_hot' },
  },
  {
    displayName: 'Sellers - interested',
    description: 'Behavior only: a page_view with page_type sell, address_submit or place_value_answer.',
    membershipDurationDays: 30,
    group: 'visitor-intent',
    spec: { kind: 'sellers_interested' },
  },
  {
    displayName: 'Sellers - started valuation',
    description: 'Behavior only: address_submit with no generate_lead. Started a home value, did not finish.',
    membershipDurationDays: 30,
    group: 'visitor-intent',
    spec: { kind: 'sellers_started_valuation' },
  },
  {
    displayName: 'Visitor intent: buyer',
    description: 'User property visitor_intent is buyer (lib/analytics/visitor-intent.ts). Behavior only.',
    membershipDurationDays: 30,
    group: 'visitor-intent',
    spec: { kind: 'visitor_intent', value: 'buyer' },
  },
  {
    displayName: 'Visitor intent: seller',
    description: 'User property visitor_intent is seller (lib/analytics/visitor-intent.ts). Behavior only.',
    membershipDurationDays: 30,
    group: 'visitor-intent',
    spec: { kind: 'visitor_intent', value: 'seller' },
  },
  {
    displayName: 'Visitor intent: both',
    description: 'User property visitor_intent is both: buyer and seller signals. Behavior only.',
    membershipDurationDays: 30,
    group: 'visitor-intent',
    spec: { kind: 'visitor_intent', value: 'both' },
  },
]

/**
 * Fields a buyer or seller audience may never filter on (fair housing: an
 * audience that can target housing ads is built from behavior only). Demographics
 * (age, gender, interests, language) and every place field, GA4's geography
 * dimensions and this site's own place parameters and user property
 * (primary_market, city, city_slug, community_slug, place), with or without a
 * customUser: / customEvent: prefix. Matched against every fieldName in a
 * 'visitor-intent' group payload; the builder throws on a match.
 */
const FAIR_HOUSING_BANNED_FIELDS =
  /^(?:customUser:|customEvent:)?(userAgeBracket|userGender|age|gender|brandingInterest|interests?|language|languageCode|city|cityId|city_slug|community_slug|place|place_slug|primary_market|region|country|countryId|continent|continentId|subContinent|subContinentCode|metro|postalCode|postal_code|zip)$/i

/**
 * Audiences whose filters were rebuilt. GA4 keeps an audience's filters
 * immutable (Admin API v1alpha: filterClauses "Required. Immutable."), so a
 * rebuild renames the live audience created before `rebuiltOn` to `retiredAs`
 * and creates the spec's definition under the same name. A rename is reversible;
 * an archive is not. Idempotent: once the rebuilt audience exists (created on or
 * after rebuiltOn), nothing is renamed again.
 *
 * High-intent sellers (Matt 2026-10-09: rebuild the landing-page audiences on
 * /sell and /buy). The 2026-05-22 definition needed view_landing_page with
 * lp_variant seller-home-value AND scroll_depth with percent_scrolled over 74.
 * No page sent view_landing_page from 2026-08-01 to 2026-10-09, and no tracker
 * has ever sent percent_scrolled, so it could not match anyone. A first rebuild
 * the same day filtered on `percent` and was archived within minutes: GA4 never
 * receives that name either (see the high_intent_sellers payload).
 */
const REBUILT_AUDIENCES = {
  'High-intent sellers': {
    rebuiltOn: '2026-10-14',
    retiredAs: 'High-intent sellers (retired 2026-10-14, never matched)',
  },
}

// ──────────────────────────────────────────────────────────────────────────
// Audience payload builder — produces real GA4 Admin API filter clauses.
//
// GA4 audience clauses are deeply nested. The "spec.kind" lets us keep a
// single switch in one place. Each branch returns the full request body
// for analyticsadmin.properties.audiences.create.
// ──────────────────────────────────────────────────────────────────────────

/**
 * GA4 audience filter expression nesting (verified by inspecting an existing
 * audience on property 527333348):
 *
 *   filterExpression
 *     andGroup.filterExpressions[]
 *       orGroup.filterExpressions[]
 *         eventFilter | dimensionOrMetricFilter
 *           (eventFilter may have eventParameterFilterExpression with the
 *            same andGroup→orGroup nesting)
 *
 * Numeric operation enum (from real audience pulls):
 *   EQUAL | LESS_THAN | LESS_THAN_OR_EQUAL | GREATER_THAN | GREATER_THAN_OR_EQUAL
 * For session-count gates we use GREATER_THAN with value=2 to mean "3+", as
 * the GREATER_THAN_OR_EQUAL form intermittently fails validation.
 */
function wrapAndOrGroup(leafFilter) {
  return {
    andGroup: {
      filterExpressions: [
        { orGroup: { filterExpressions: [leafFilter] } },
      ],
    },
  }
}

function eventFilter(eventName, paramFilters = []) {
  return {
    eventFilter: {
      eventName,
      ...(paramFilters.length
        ? {
            eventParameterFilterExpression: {
              andGroup: {
                filterExpressions: paramFilters.map((f) => ({
                  orGroup: { filterExpressions: [f] },
                })),
              },
            },
          }
        : {}),
    },
  }
}

function dimensionFilterStringEquals(fieldName, value) {
  return {
    dimensionOrMetricFilter: {
      fieldName,
      stringFilter: { matchType: 'EXACT', value },
    },
  }
}

function dimensionFilterGt(fieldName, value) {
  return {
    dimensionOrMetricFilter: {
      fieldName,
      numericFilter: {
        operation: 'GREATER_THAN',
        value: { int64Value: String(value) },
      },
    },
  }
}

// String CONTAINS leaf (case-insensitive). Used for traffic-source matching.
function dimContains(fieldName, value) {
  return {
    dimensionOrMetricFilter: {
      fieldName,
      stringFilter: { matchType: 'CONTAINS', value, caseSensitive: false },
    },
  }
}

// Regex leaf. With value '.+' this means "dimension is set to any non-empty
// value" — the canonical "fub_person_id is present" test.
function dimRegex(fieldName, value) {
  return {
    dimensionOrMetricFilter: {
      fieldName,
      stringFilter: { matchType: 'FULL_REGEXP', value },
    },
  }
}

// INCLUDE clause whose single orGroup ORs together every leaf in `leaves`.
// Multiple INCLUDE clauses on one audience AND together at the user level.
function includeMultiOr(leaves) {
  return {
    clauseType: 'INCLUDE',
    simpleFilter: {
      scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
      filterExpression: {
        andGroup: { filterExpressions: [{ orGroup: { filterExpressions: leaves } }] },
      },
    },
  }
}

// Facebook/Instagram first-touch source leaves (reused by visitor + lead audiences).
const FACEBOOK_SOURCE_LEAVES = [
  dimContains('firstUserSource', 'facebook'),
  dimContains('firstUserSource', 'instagram'),
]
const GOOGLE_SOURCE_LEAVES = [dimContains('firstUserSource', 'google')]

function buildAudiencePayload(parent, audience) {
  const base = {
    parent,
    requestBody: {
      displayName: audience.displayName,
      description: audience.description,
      membershipDurationDays: audience.membershipDurationDays,
      filterClauses: [],
    },
  }

  const includeAcrossAllSessions = (leafFilter) => ({
    clauseType: 'INCLUDE',
    simpleFilter: {
      scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
      filterExpression: wrapAndOrGroup(leafFilter),
    },
  })
  const excludeAcrossAllSessions = (leafFilter) => ({
    clauseType: 'EXCLUDE',
    simpleFilter: {
      scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
      filterExpression: wrapAndOrGroup(leafFilter),
    },
  })

  switch (audience.spec.kind) {
    case 'form_starters_no_submit':
      base.requestBody.filterClauses = [
        includeAcrossAllSessions(eventFilter('form_start')),
        excludeAcrossAllSessions(eventFilter('generate_lead')),
      ]
      break

    case 'lp_visitors_7d':
    case 'lp_visitors_30d':
      base.requestBody.filterClauses = [
        includeAcrossAllSessions(eventFilter('view_landing_page')),
        excludeAcrossAllSessions(eventFilter('generate_lead')),
      ]
      break

    case 'repeat_visitors':
      // 'sessions' is not a valid audience field. Instead, gate on the
      // session_start event firing at least 3 times via the
      // simpleFilter.atAnyPointInTime + a count predicate would be ideal,
      // but the simplest portable approach is: 3+ session_start events.
      // Implemented as INCLUDE event_count(session_start) > 2.
      base.requestBody.filterClauses = [
        {
          clauseType: 'INCLUDE',
          simpleFilter: {
            scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
            filterExpression: wrapAndOrGroup({
              eventFilter: {
                eventName: 'session_start',
                eventParameterFilterExpression: {
                  andGroup: {
                    filterExpressions: [
                      {
                        orGroup: {
                          filterExpressions: [
                            {
                              dimensionOrMetricFilter: {
                                fieldName: 'eventCount',
                                numericFilter: {
                                  operation: 'GREATER_THAN',
                                  value: { int64Value: '2' },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            }),
          },
        },
        excludeAcrossAllSessions(eventFilter('generate_lead')),
      ]
      break

    case 'high_intent_sellers':
      // Scrolled 75% or more of a seller landing page, read off the one event
      // that says both. V3SectionTracker pushes scroll_depth with page_type
      // (pageTypeFromPath: 'sell' on every /sell page) and percent (25, 50, 75,
      // 100); the GTM GA4 Event tag sends page_type as page context and folds
      // percent into `depth` (lib/analytics/ga4-browser-events.ts
      // GA4_PARAM_ALIASES), so GA4 holds depth, never percent. The server mirror
      // in /api/visitors/track sends scroll_depth with page_type and no depth,
      // so only the browser hit can match. Event parameters go by their bare
      // names, the form GA4 stores (the 2026-05-22 audience: lp_variant,
      // percent_scrolled).
      base.requestBody.filterClauses = [
        includeAcrossAllSessions(
          eventFilter('scroll_depth', [
            dimensionFilterStringEquals('page_type', 'sell'),
            dimensionFilterGt('depth', 74),
          ])
        ),
      ]
      break

    case 'facebook_visitors':
      base.requestBody.filterClauses = [includeMultiOr(FACEBOOK_SOURCE_LEAVES)]
      break

    case 'google_visitors':
      base.requestBody.filterClauses = [includeMultiOr(GOOGLE_SOURCE_LEAVES)]
      break

    case 'returning_visitors':
      // 2+ sessions: session_start event fired more than once.
      base.requestBody.filterClauses = [
        {
          clauseType: 'INCLUDE',
          simpleFilter: {
            scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
            filterExpression: wrapAndOrGroup({
              eventFilter: {
                eventName: 'session_start',
                eventParameterFilterExpression: {
                  andGroup: {
                    filterExpressions: [
                      {
                        orGroup: {
                          filterExpressions: [
                            {
                              dimensionOrMetricFilter: {
                                fieldName: 'eventCount',
                                numericFilter: {
                                  operation: 'GREATER_THAN',
                                  value: { int64Value: '1' },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            }),
          },
        },
      ]
      break

    case 'identified_facebook_leads':
      // FUB Person ID is set (regex .+ = any non-empty value) AND first source is Meta.
      // Two INCLUDE clauses AND together at the user level.
      base.requestBody.filterClauses = [
        includeMultiOr([dimRegex('customEvent:fub_person_id', '.+')]),
        includeMultiOr(FACEBOOK_SOURCE_LEAVES),
      ]
      break

    case 'identified_google_leads':
      base.requestBody.filterClauses = [
        includeMultiOr([dimRegex('customEvent:fub_person_id', '.+')]),
        includeMultiOr(GOOGLE_SOURCE_LEAVES),
      ]
      break

    case 'real_site_traffic':
      // Hostname is one of our real domains. ryan-realty.com CONTAINS also
      // matches www.ryan-realty.com. Ghost spam fakes the hostname, so this
      // cohort excludes it. Apply as a Comparison in any standard report.
      base.requestBody.filterClauses = [
        includeMultiOr([
          dimContains('hostName', 'ryan-realty.com'),
          dimContains('hostName', 'ryanrealty.vercel.app'), // staging-host-ok: GA4 filter on the INCOMING hostname
        ]),
      ]
      break

    case 'buyers_active':
      // 3+ view_listing in any rolling 30 days (eventCount > 2, the form the
      // repeat_visitors audience uses; GREATER_THAN_OR_EQUAL intermittently fails
      // validation), or any save_listing. One INCLUDE clause, the two ORed.
      base.requestBody.filterClauses = [
        includeMultiOr([
          {
            eventFilter: {
              eventName: 'view_listing',
              eventParameterFilterExpression: {
                andGroup: {
                  filterExpressions: [
                    {
                      orGroup: {
                        filterExpressions: [
                          {
                            dimensionOrMetricFilter: {
                              fieldName: 'eventCount',
                              inAnyNDayPeriod: 30,
                              numericFilter: { operation: 'GREATER_THAN', value: { int64Value: '2' } },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
          eventFilter('save_listing'),
        ]),
      ]
      break

    case 'buyers_hot':
      base.requestBody.filterClauses = [
        includeMultiOr([eventFilter('schedule_tour_click'), eventFilter('ask_question_click'), eventFilter('call_initiated')]),
      ]
      break

    case 'sellers_interested':
      // page_type is the flat page context both GA4 tags send (bare event
      // parameter name, as high_intent_sellers filters it).
      base.requestBody.filterClauses = [
        includeMultiOr([
          eventFilter('page_view', [dimensionFilterStringEquals('page_type', 'sell')]),
          eventFilter('address_submit'),
          eventFilter('place_value_answer'),
        ]),
      ]
      break

    case 'sellers_started_valuation':
      base.requestBody.filterClauses = [
        includeAcrossAllSessions(eventFilter('address_submit')),
        excludeAcrossAllSessions(eventFilter('generate_lead')),
      ]
      break

    case 'visitor_intent':
      // The user-scoped custom dimension visitor_intent (scripts/ga4-admin-setup.mjs
      // registers it; it must exist before this audience is created).
      base.requestBody.filterClauses = [includeMultiOr([dimensionFilterStringEquals('customUser:visitor_intent', audience.spec.value)])]
      break

    default:
      throw new Error(`Unknown audience spec.kind: ${audience.spec.kind}`)
  }
  if (audience.group === 'visitor-intent') {
    const banned = fieldNamesIn(base.requestBody.filterClauses).filter((f) => FAIR_HOUSING_BANNED_FIELDS.test(f))
    if (banned.length) throw new Error(`${audience.displayName}: a buyer or seller audience may not filter on ${banned.join(', ')} (fair housing: behavior only)`)
  }
  return base
}

/** Every fieldName anywhere in a filter tree. */
function fieldNamesIn(node, out = []) {
  if (Array.isArray(node)) for (const n of node) fieldNamesIn(n, out)
  else if (node && typeof node === 'object') {
    if (typeof node.fieldName === 'string') out.push(node.fieldName)
    for (const v of Object.values(node)) fieldNamesIn(v, out)
  }
  return out
}

// ──────────────────────────────────────────────────────────────────────────
// Auth + API client
// ──────────────────────────────────────────────────────────────────────────

function getAdminClient() {
  const key = PRIVATE_KEY.replace(/\\n/g, '\n')
  // For admin (write) operations we DO NOT impersonate via DWD subject. The
  // viewer@ryanrealty.iam.gserviceaccount.com service account is added directly
  // as a user on GA4 property 527333348 with Editor permissions. DWD subject
  // is only required for read-only GA4 Data API via matt@ryan-realty.com.
  const jwt = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key,
    scopes: [
      'https://www.googleapis.com/auth/analytics.edit',
      'https://www.googleapis.com/auth/analytics.readonly',
    ],
  })
  // v1alpha is required for audiences. v1beta lacks audiences and keyEvents.
  return google.analyticsadmin({ version: 'v1alpha', auth: jwt })
}

// ──────────────────────────────────────────────────────────────────────────
// Audit — read current state
// ──────────────────────────────────────────────────────────────────────────

async function audit() {
  const admin = getAdminClient()
  const parent = `properties/${PROPERTY_ID}`

  console.log(`Auditing GA4 property ${PROPERTY_ID}…`)

  const [propertyRes, conversionsRes, dimensionsRes, audiencesRes] = await Promise.all([
    admin.properties.get({ name: parent }),
    listAllConversionEvents(admin, parent),
    listAllCustomDimensions(admin, parent),
    listAllAudiences(admin, parent),
  ])

  const property = propertyRes.data

  const result = {
    auditedAt: new Date().toISOString(),
    propertyId: PROPERTY_ID,
    property: {
      name: property.name,
      displayName: property.displayName,
      timeZone: property.timeZone,
      currencyCode: property.currencyCode,
      industryCategory: property.industryCategory,
      createTime: property.createTime,
      updateTime: property.updateTime,
    },
    conversionEvents: conversionsRes.map((c) => ({
      name: c.name,
      eventName: c.eventName,
      deletable: c.deletable,
      custom: c.custom,
      createTime: c.createTime,
    })),
    customDimensions: dimensionsRes.map((d) => ({
      name: d.name,
      parameterName: d.parameterName,
      displayName: d.displayName,
      description: d.description,
      scope: d.scope,
    })),
    audiences: audiencesRes.map((a) => ({
      name: a.name,
      displayName: a.displayName,
      description: a.description,
      membershipDurationDays: a.membershipDurationDays,
      adsPersonalizationEnabled: a.adsPersonalizationEnabled,
    })),
    counts: {
      conversionEvents: conversionsRes.length,
      customDimensions: dimensionsRes.length,
      audiences: audiencesRes.length,
    },
  }

  // Gap analysis: what's missing vs the locked config?
  const existingConvSet = new Set(result.conversionEvents.map((c) => c.eventName))
  const existingDimSet = new Set(result.customDimensions.map((d) => `${d.parameterName}|${d.scope}`))
  const existingAudSet = new Set(result.audiences.map((a) => a.displayName))

  result.gap = {
    missingConversionEvents: CONVERSION_EVENTS.filter((c) => !existingConvSet.has(c.name)).map((c) => c.name),
    missingCustomDimensions: CUSTOM_DIMENSIONS.filter((d) => !existingDimSet.has(`${d.parameterName}|${d.scope}`)).map((d) => `${d.parameterName} (${d.scope})`),
    missingAudiences: AUDIENCES.filter((a) => !existingAudSet.has(a.displayName)).map((a) => a.displayName),
  }

  const outDir = join(REPO_ROOT, 'out')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'ga4-audit.json')
  writeFileSync(outPath, JSON.stringify(result, null, 2))
  console.log(`Audit written to ${outPath}`)
  console.log(`  conversion events: ${result.counts.conversionEvents} (${result.gap.missingConversionEvents.length} missing from locked spec)`)
  console.log(`  custom dimensions: ${result.counts.customDimensions} (${result.gap.missingCustomDimensions.length} missing from locked spec)`)
  console.log(`  audiences:         ${result.counts.audiences} (${result.gap.missingAudiences.length} missing from locked spec)`)
  if (result.gap.missingConversionEvents.length) console.log(`    missing conv: ${result.gap.missingConversionEvents.join(', ')}`)
  if (result.gap.missingCustomDimensions.length) console.log(`    missing dim:  ${result.gap.missingCustomDimensions.join(', ')}`)
  if (result.gap.missingAudiences.length)        console.log(`    missing aud:  ${result.gap.missingAudiences.join(', ')}`)
  return result
}

async function listAllConversionEvents(admin, parent) {
  const items = []
  let pageToken
  do {
    const res = await admin.properties.conversionEvents.list({ parent, pageSize: 200, pageToken })
    items.push(...(res.data.conversionEvents ?? []))
    pageToken = res.data.nextPageToken
  } while (pageToken)
  return items
}

async function listAllCustomDimensions(admin, parent) {
  const items = []
  let pageToken
  do {
    const res = await admin.properties.customDimensions.list({ parent, pageSize: 200, pageToken })
    items.push(...(res.data.customDimensions ?? []))
    pageToken = res.data.nextPageToken
  } while (pageToken)
  return items
}

async function listAllAudiences(admin, parent) {
  const items = []
  let pageToken
  do {
    const res = await admin.properties.audiences.list({ parent, pageSize: 200, pageToken })
    items.push(...(res.data.audiences ?? []))
    pageToken = res.data.nextPageToken
  } while (pageToken)
  return items
}

// ──────────────────────────────────────────────────────────────────────────
// Apply — idempotent mutation
// ──────────────────────────────────────────────────────────────────────────

async function apply() {
  const admin = getAdminClient()
  const parent = `properties/${PROPERTY_ID}`

  console.log(`Applying locked config to GA4 property ${PROPERTY_ID}…`)

  const log = { applied: [], skipped: [], errors: [] }

  // 1. Conversion events
  const existingConversions = await listAllConversionEvents(admin, parent)
  const existingConvSet = new Set(existingConversions.map((c) => c.eventName))
  for (const conv of CONVERSION_EVENTS) {
    if (existingConvSet.has(conv.name)) {
      log.skipped.push(`conversion:${conv.name} (already exists)`)
      console.log(`  [skip] conversion event already exists: ${conv.name}`)
      continue
    }
    try {
      await admin.properties.conversionEvents.create({
        parent,
        requestBody: { eventName: conv.name },
      })
      log.applied.push(`conversion:${conv.name}`)
      console.log(`  [+]    created conversion event: ${conv.name} (${conv.purpose})`)
    } catch (e) {
      const msg = e?.message ?? String(e)
      log.errors.push({ kind: 'conversion', name: conv.name, error: msg })
      console.error(`  [!]    failed conversion ${conv.name}: ${msg}`)
    }
  }

  // 2. Custom dimensions
  const existingDimensions = await listAllCustomDimensions(admin, parent)
  // Key by (parameterName, scope) — same param at different scopes are distinct.
  const existingDimSet = new Set(existingDimensions.map((d) => `${d.parameterName}|${d.scope}`))
  for (const dim of CUSTOM_DIMENSIONS) {
    const key = `${dim.parameterName}|${dim.scope}`
    if (existingDimSet.has(key)) {
      log.skipped.push(`dimension:${dim.parameterName} scope=${dim.scope} (already exists)`)
      console.log(`  [skip] custom dimension already exists: ${dim.parameterName} (${dim.scope})`)
      continue
    }
    try {
      await admin.properties.customDimensions.create({
        parent,
        requestBody: {
          parameterName: dim.parameterName,
          displayName: dim.displayName,
          description: dim.description,
          scope: dim.scope,
        },
      })
      log.applied.push(`dimension:${dim.parameterName} (${dim.scope})`)
      console.log(`  [+]    created custom dimension: ${dim.parameterName} (${dim.scope})`)
    } catch (e) {
      const msg = e?.message ?? String(e)
      log.errors.push({ kind: 'dimension', name: dim.parameterName, error: msg })
      console.error(`  [!]    failed dimension ${dim.parameterName}: ${msg}`)
    }
  }

  // 3. Audiences
  await applyAudiences(admin, parent, log)

  return finishApply(log)
}

/**
 * Create every missing audience, and rebuild each REBUILT_AUDIENCES entry whose
 * live audience predates its rebuild: rename the old one to `retiredAs`, then
 * create the spec's definition. The new audience is created only after the
 * rename lands, so two audiences never share a name.
 */
async function applyAudiences(admin, parent, log, { dryRun = false, group = null } = {}) {
  const existingAudiences = await listAllAudiences(admin, parent)
  for (const audience of AUDIENCES) {
    if (group && audience.group !== group) continue
    const live = existingAudiences.find((a) => a.displayName === audience.displayName)
    const rebuild = REBUILT_AUDIENCES[audience.displayName]
    const stale = live && rebuild && Date.parse(live.createTime) < Date.parse(rebuild.rebuiltOn)
    if (live && !stale) {
      log.skipped.push(`audience:${audience.displayName} (already exists)`)
      console.log(`  [skip] audience already exists: ${audience.displayName}`)
      continue
    }
    if (dryRun) {
      // Build the payload anyway, so a malformed or non-compliant definition fails here.
      const payload = buildAudiencePayload(parent, audience)
      if (stale) {
        log.planned.push(`audience-rename:${live.name} -> ${rebuild.retiredAs}`)
        console.log(`  [plan] rename ${live.name} to: ${rebuild.retiredAs}`)
      }
      log.planned.push(`audience:${audience.displayName}`)
      console.log(`  [plan] create audience: ${audience.displayName}`)
      console.log(JSON.stringify(payload.requestBody, null, 2).replace(/^/gm, '         '))
      continue
    }
    try {
      if (stale) {
        await admin.properties.audiences.patch({
          name: live.name,
          updateMask: 'displayName',
          requestBody: { displayName: rebuild.retiredAs },
        })
        log.applied.push(`audience-renamed:${live.name} -> ${rebuild.retiredAs}`)
        console.log(`  [~]    renamed ${live.name} to: ${rebuild.retiredAs}`)
      }
      const payload = buildAudiencePayload(parent, audience)
      const created = await admin.properties.audiences.create(payload)
      log.applied.push(`audience:${audience.displayName} (${created.data?.name ?? 'created'})`)
      console.log(`  [+]    created audience: ${audience.displayName} (${created.data?.name ?? ''})`)
    } catch (e) {
      const msg = e?.message ?? String(e)
      log.errors.push({ kind: 'audience', name: audience.displayName, error: msg })
      console.error(`  [!]    failed audience ${audience.displayName}: ${msg}`)
    }
  }
}

async function applyAudiencesOnly({ dryRun = false, group = null } = {}) {
  const admin = getAdminClient()
  const parent = `properties/${PROPERTY_ID}`
  const scope = group ? ` (group ${group})` : ''
  if (dryRun) {
    console.log(`DRY RUN: the audience step${scope} for GA4 property ${PROPERTY_ID}. Reads only; nothing is created or renamed.`)
    const log = { planned: [], skipped: [], errors: [] }
    await applyAudiences(admin, parent, log, { dryRun: true, group })
    console.log('')
    console.log('Dry-run summary:')
    console.log(`  would create or rename: ${log.planned.length}`)
    console.log(`  skipped: ${log.skipped.length} (already exist)`)
    return log
  }
  console.log(`Applying the audience step${scope} to GA4 property ${PROPERTY_ID}…`)
  const log = { applied: [], skipped: [], errors: [] }
  await applyAudiences(admin, parent, log, { group })
  return finishApply(log)
}

function finishApply(log) {
  console.log('')
  console.log('Apply summary:')
  console.log(`  applied: ${log.applied.length}`)
  console.log(`  skipped: ${log.skipped.length} (already configured)`)
  console.log(`  errors:  ${log.errors.length}`)

  const outDir = join(REPO_ROOT, 'out')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'ga4-apply.json')
  writeFileSync(outPath, JSON.stringify({ appliedAt: new Date().toISOString(), ...log }, null, 2))
  console.log(`Apply log written to ${outPath}`)
  if (log.errors.length) process.exitCode = 1

  return log
}

// ──────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  const mode = (process.argv[2] || '').trim()
  const flags = process.argv.slice(3)
  const dryRun = flags.includes('--dry-run')
  const group = (flags.find((f) => f.startsWith('--group=')) || '').slice('--group='.length) || null
  if (group && !AUDIENCES.some((a) => a.group === group)) {
    console.error(`Unknown audience group: ${group}`)
    process.exit(1)
  }
  if (mode === 'audit') {
    await audit()
  } else if (mode === 'apply') {
    if (dryRun) {
      console.error('apply has no dry run; use apply-audiences --dry-run (audiences) or ga4-admin-setup.mjs --dry-run (dimensions, key events).')
      process.exit(1)
    }
    await apply()
  } else if (mode === 'apply-audiences') {
    await applyAudiencesOnly({ dryRun, group })
  } else {
    console.error('Usage: node scripts/ga4-admin.mjs <audit|apply|apply-audiences [--dry-run] [--group=visitor-intent]>')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('FATAL:', e?.message ?? e)
  if (e?.errors) console.error(JSON.stringify(e.errors, null, 2))
  process.exit(1)
})
