#!/usr/bin/env node
/**
 * GA4 Admin API config — audit + apply.
 *
 * Modes:
 *   node scripts/ga4-admin.mjs audit   → list current config, write to out/ga4-audit.json
 *   node scripts/ga4-admin.mjs apply   → apply the locked config below (idempotent)
 *
 * Auth: reuses GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *       from .env.local. Adds analytics.edit scope so we can mutate config.
 *
 * Locked config:
 *   - 7 conversion events (generate_lead, valuation_requested, contact_agent,
 *     call_initiated, tour_requested, cma_anchor_click, listing_showing_click)
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
  if (!existsSync(envPath)) {
    console.error('FATAL: .env.local not found at', envPath)
    process.exit(1)
  }
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

/** Events that should be marked as conversions (key events in GA4 vocab). */
const CONVERSION_EVENTS = [
  { name: 'generate_lead',         purpose: 'primary seller lead conversion' },
  { name: 'valuation_requested',   purpose: 'CMA request' },
  { name: 'contact_agent',         purpose: 'direct broker contact' },
  { name: 'call_initiated',        purpose: 'tel: link click' },
  { name: 'tour_requested',        purpose: 'buyer tour request' },
  { name: 'cma_anchor_click',      purpose: 'CMA section interaction' },
  { name: 'listing_showing_click', purpose: 'listing page CTA' },
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
  // User-scoped
  { parameterName: 'assigned_broker',     displayName: 'Assigned Broker',     description: 'First broker assigned to this user — stable user property',          scope: 'USER' },
  { parameterName: 'lead_status',         displayName: 'Lead Status',         description: 'Current FUB pipeline status — synced from FUB via user property',    scope: 'USER' },
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
    description: 'Visited /lp/seller-home-value AND scroll_depth >= 75.',
    membershipDurationDays: 30,
    spec: { kind: 'high_intent_sellers' },
  },
]

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
      base.requestBody.filterClauses = [
        // High-intent sellers: visited the seller LP AND scrolled past 74%.
        // Two INCLUDE clauses combine with AND semantics across clauses.
        includeAcrossAllSessions(
          eventFilter('view_landing_page', [
            dimensionFilterStringEquals('customEvent:lp_variant', 'seller-home-value'),
          ])
        ),
        includeAcrossAllSessions(
          eventFilter('scroll_depth', [dimensionFilterGt('percent_scrolled', 74)])
        ),
      ]
      break

    default:
      throw new Error(`Unknown audience spec.kind: ${audience.spec.kind}`)
  }
  return base
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
  const existingAudiences = await listAllAudiences(admin, parent)
  const existingAudSet = new Set(existingAudiences.map((a) => a.displayName))
  for (const audience of AUDIENCES) {
    if (existingAudSet.has(audience.displayName)) {
      log.skipped.push(`audience:${audience.displayName} (already exists)`)
      console.log(`  [skip] audience already exists: ${audience.displayName}`)
      continue
    }
    try {
      const payload = buildAudiencePayload(parent, audience)
      await admin.properties.audiences.create(payload)
      log.applied.push(`audience:${audience.displayName}`)
      console.log(`  [+]    created audience: ${audience.displayName}`)
    } catch (e) {
      const msg = e?.message ?? String(e)
      log.errors.push({ kind: 'audience', name: audience.displayName, error: msg })
      console.error(`  [!]    failed audience ${audience.displayName}: ${msg}`)
    }
  }

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

  return log
}

// ──────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  const mode = (process.argv[2] || '').trim()
  if (mode === 'audit') {
    await audit()
  } else if (mode === 'apply') {
    await apply()
  } else {
    console.error('Usage: node scripts/ga4-admin.mjs <audit|apply>')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('FATAL:', e?.message ?? e)
  if (e?.errors) console.error(JSON.stringify(e.errors, null, 2))
  process.exit(1)
})
