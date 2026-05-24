#!/usr/bin/env node
/**
 * scripts/ga4-admin-setup.mjs
 *
 * Idempotent Google Analytics 4 Admin API setup. Brings the GA4 property
 * up to Ryan Realty's locked best-practice baseline:
 *
 *   - Enables Google Signals (cross-device + demographics + interests)
 *   - Ensures all canonical custom dimensions exist
 *   - Marks every canonical lead event as a conversion (key event)
 *   - Sets acquisition + other conversion lookback windows to 90 days
 *     (real estate's long sales cycle)
 *   - Sets data retention to 14 months (the maximum on the Standard tier)
 *
 * Reports the diff between current state and desired state, then applies
 * only the changes that are needed.
 *
 * Reporting Identity (Blended / Observed / Device-only) is NOT exposed
 * by the Admin API. Matt has to flip that one switch in the GA4 UI:
 *   Admin → Property settings → Data display → Reporting identity → Blended
 *
 * Auth: same service account already used by getGA4Summary
 * (`viewer@ryanrealty.iam.gserviceaccount.com`). Requires
 * `analytics.edit` scope, which works as long as the service account has
 * been promoted to Editor or Administrator on the GA4 property.
 *
 * Usage:
 *   node scripts/ga4-admin-setup.mjs            # apply changes
 *   node scripts/ga4-admin-setup.mjs --dry-run  # show diff only
 *
 * Run with `set -a && source .env.local && set +a &&` if local creds need
 * to be loaded, or pull from Vercel first:
 *   vercel env pull .env.production.tmp --environment=production --yes
 *   set -a && source .env.production.tmp && set +a
 *   node scripts/ga4-admin-setup.mjs --dry-run
 *   rm .env.production.tmp
 */

import { GoogleAuth } from 'google-auth-library'

const DRY_RUN = process.argv.includes('--dry-run')

const PROPERTY_ID = process.env.GOOGLE_GA4_PROPERTY_ID
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!PROPERTY_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error('Missing env: GOOGLE_GA4_PROPERTY_ID + GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY required.')
  process.exit(1)
}

const auth = new GoogleAuth({
  credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
  scopes: ['https://www.googleapis.com/auth/analytics.edit'],
})
const token = (await (await auth.getClient()).getAccessToken()).token

async function api(method, path, body) {
  const url = `https://analyticsadmin.googleapis.com${path}`
  const init = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  const res = await fetch(url, init)
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { status: res.status, ok: res.ok, body: parsed }
}

// ─── Desired state ────────────────────────────────────────────────────────

const DESIRED_CUSTOM_DIMENSIONS = [
  // Event-scoped — pivot dimensions for the lead-flow + traffic-sources reports
  { parameterName: 'lp_variant',         displayName: 'LP Variant',         scope: 'EVENT', description: 'Which landing page or form variant fired the event' },
  { parameterName: 'lp_source',          displayName: 'LP Source',          scope: 'EVENT', description: 'utm_source captured at form submit' },
  { parameterName: 'lp_medium',          displayName: 'LP Medium',          scope: 'EVENT', description: 'utm_medium' },
  { parameterName: 'lp_campaign',        displayName: 'LP Campaign',        scope: 'EVENT', description: 'utm_campaign — the FB ad campaign name when set per UTM convention' },
  { parameterName: 'lp_content',         displayName: 'LP Content',         scope: 'EVENT', description: 'utm_content — ad-set or creative variant' },
  { parameterName: 'broker_slug',        displayName: 'Broker Slug',        scope: 'EVENT', description: 'Broker the lead was assigned to (matt|rebecca|paul)' },
  { parameterName: 'lead_classification', displayName: 'Lead Classification', scope: 'EVENT', description: 'hot | warm | nurture | unknown' },
  { parameterName: 'lead_type',          displayName: 'Lead Type',          scope: 'EVENT', description: 'seller | buyer | listing_inquiry | exit_intent | page_cta | general | cta_click' },

  // User-scoped — make every event for an identified person filterable by these
  { parameterName: 'assigned_broker',    displayName: 'Assigned Broker',    scope: 'USER',  description: 'Broker the lead has been routed to (from canonical-lead-tagger)' },
]

const DESIRED_CONVERSION_EVENTS = [
  'generate_lead',           // canonical lead — fires from every form via fireLeadGenerated
  'listing_inquiry',         // listing-detail Schedule showing / Ask a question
  'home_valuation_cta_click', // mid-funnel: visitor clicked the home-value CTA
  'valuation_requested',     // legacy alias the home-valuation form still fires
  'tour_requested',          // listing tour request
  'contact_agent',           // contact-agent button click
  'cma_downloaded',          // CMA PDF delivered (uncommon but worth marking)
  'newsletter_signup',       // pulse signup
  'schedule_showing',        // listing detail
  'property_inquiry',        // catch-all for buyer interest
]

// 90 days matches what we tag in marketing_assignments + real-estate sales cycle.
const DESIRED_ACQ_LOOKBACK = 'ACQUISITION_CONVERSION_EVENT_LOOKBACK_WINDOW_30_DAYS'  // Max allowed for acquisition is 30 days per API.
const DESIRED_OTHER_LOOKBACK = 'OTHER_CONVERSION_EVENT_LOOKBACK_WINDOW_90_DAYS'
const DESIRED_RETENTION = 'FOURTEEN_MONTHS'

// ─── Plan + apply ─────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(64)}`)
console.log(`GA4 Admin Setup — Property ${PROPERTY_ID}`)
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'APPLY'}`)
console.log('='.repeat(64))

let actionsPlanned = 0
let actionsApplied = 0
let actionsSkipped = 0
const errors = []

async function ensureGoogleSignals() {
  console.log('\n## Google Signals')
  const cur = await api('GET', `/v1alpha/properties/${PROPERTY_ID}/googleSignalsSettings`)
  console.log(`  current: state=${cur.body.state}, consent=${cur.body.consent}`)
  if (cur.body.state === 'GOOGLE_SIGNALS_ENABLED' && cur.body.consent === 'GOOGLE_SIGNALS_CONSENT_CONSENTED') {
    console.log('  ✓ ALREADY ENABLED + CONSENTED — no action')
    actionsSkipped++
    return
  }
  actionsPlanned++
  console.log('  ⚡ PLAN: enable Google Signals + mark consent CONSENTED')
  if (DRY_RUN) return
  const upd = await api(
    'PATCH',
    `/v1alpha/properties/${PROPERTY_ID}/googleSignalsSettings?updateMask=state,consent`,
    { state: 'GOOGLE_SIGNALS_ENABLED', consent: 'GOOGLE_SIGNALS_CONSENT_CONSENTED' },
  )
  if (upd.ok) {
    console.log('  ✓ APPLIED')
    actionsApplied++
  } else {
    console.log(`  ✗ FAILED: HTTP ${upd.status} ${JSON.stringify(upd.body).slice(0, 200)}`)
    errors.push(`googleSignals: HTTP ${upd.status}`)
  }
}

async function ensureCustomDimensions() {
  console.log('\n## Custom Dimensions')
  const cur = await api('GET', `/v1beta/properties/${PROPERTY_ID}/customDimensions`)
  const existing = new Set((cur.body.customDimensions ?? []).map((d) => d.parameterName))
  console.log(`  existing: ${existing.size}`)
  for (const want of DESIRED_CUSTOM_DIMENSIONS) {
    if (existing.has(want.parameterName)) {
      console.log(`  ✓ ALREADY EXISTS: ${want.parameterName}`)
      actionsSkipped++
      continue
    }
    actionsPlanned++
    console.log(`  ⚡ PLAN: create ${want.parameterName} (${want.scope}) — ${want.displayName}`)
    if (DRY_RUN) continue
    const res = await api('POST', `/v1beta/properties/${PROPERTY_ID}/customDimensions`, want)
    if (res.ok) {
      console.log(`    ✓ APPLIED`)
      actionsApplied++
    } else {
      console.log(`    ✗ FAILED: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`)
      errors.push(`customDimensions.create ${want.parameterName}: HTTP ${res.status}`)
    }
  }
}

async function ensureConversionEvents() {
  console.log('\n## Conversion Events (Key Events)')
  const cur = await api('GET', `/v1beta/properties/${PROPERTY_ID}/conversionEvents`)
  const existing = new Set((cur.body.conversionEvents ?? []).map((c) => c.eventName))
  console.log(`  existing: ${existing.size}`)
  for (const want of DESIRED_CONVERSION_EVENTS) {
    if (existing.has(want)) {
      console.log(`  ✓ ALREADY EXISTS: ${want}`)
      actionsSkipped++
      continue
    }
    actionsPlanned++
    console.log(`  ⚡ PLAN: mark ${want} as conversion event`)
    if (DRY_RUN) continue
    const res = await api('POST', `/v1beta/properties/${PROPERTY_ID}/conversionEvents`, { eventName: want })
    if (res.ok) {
      console.log(`    ✓ APPLIED`)
      actionsApplied++
    } else {
      console.log(`    ✗ FAILED: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`)
      errors.push(`conversionEvents.create ${want}: HTTP ${res.status}`)
    }
  }
}

async function ensureAttributionSettings() {
  console.log('\n## Attribution Settings')
  const cur = await api('GET', `/v1alpha/properties/${PROPERTY_ID}/attributionSettings`)
  console.log(`  current acq lookback: ${cur.body.acquisitionConversionEventLookbackWindow}`)
  console.log(`  current other lookback: ${cur.body.otherConversionEventLookbackWindow}`)
  console.log(`  current export scope: ${cur.body.adsWebConversionDataExportScope}`)
  const updates = {}
  const masks = []
  if (cur.body.acquisitionConversionEventLookbackWindow !== DESIRED_ACQ_LOOKBACK) {
    updates.acquisitionConversionEventLookbackWindow = DESIRED_ACQ_LOOKBACK
    masks.push('acquisitionConversionEventLookbackWindow')
    console.log(`  ⚡ PLAN: set acq lookback → ${DESIRED_ACQ_LOOKBACK}`)
  }
  if (cur.body.otherConversionEventLookbackWindow !== DESIRED_OTHER_LOOKBACK) {
    updates.otherConversionEventLookbackWindow = DESIRED_OTHER_LOOKBACK
    masks.push('otherConversionEventLookbackWindow')
    console.log(`  ⚡ PLAN: set other lookback → ${DESIRED_OTHER_LOOKBACK}`)
  }
  if (masks.length === 0) {
    console.log('  ✓ ALREADY CORRECT — no action')
    actionsSkipped++
    return
  }
  actionsPlanned += masks.length
  if (DRY_RUN) return
  const res = await api(
    'PATCH',
    `/v1alpha/properties/${PROPERTY_ID}/attributionSettings?updateMask=${masks.join(',')}`,
    updates,
  )
  if (res.ok) {
    console.log(`  ✓ APPLIED`)
    actionsApplied += masks.length
  } else {
    console.log(`  ✗ FAILED: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`)
    errors.push(`attributionSettings: HTTP ${res.status}`)
  }
}

async function ensureDataRetention() {
  console.log('\n## Data Retention')
  const cur = await api('GET', `/v1beta/properties/${PROPERTY_ID}/dataRetentionSettings`)
  console.log(`  current: ${cur.body.eventDataRetention}, resetOnNewActivity=${cur.body.resetUserDataOnNewActivity}`)
  if (cur.body.eventDataRetention === DESIRED_RETENTION) {
    console.log('  ✓ ALREADY CORRECT — no action')
    actionsSkipped++
    return
  }
  actionsPlanned++
  console.log(`  ⚡ PLAN: set retention → ${DESIRED_RETENTION}`)
  if (DRY_RUN) return
  const res = await api(
    'PATCH',
    `/v1beta/properties/${PROPERTY_ID}/dataRetentionSettings?updateMask=eventDataRetention`,
    { eventDataRetention: DESIRED_RETENTION },
  )
  if (res.ok) {
    console.log(`  ✓ APPLIED`)
    actionsApplied++
  } else {
    console.log(`  ✗ FAILED: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`)
    errors.push(`dataRetention: HTTP ${res.status}`)
  }
}

await ensureGoogleSignals()
await ensureCustomDimensions()
await ensureConversionEvents()
await ensureAttributionSettings()
await ensureDataRetention()

console.log(`\n${'='.repeat(64)}`)
console.log(`Summary`)
console.log('='.repeat(64))
console.log(`  Planned: ${actionsPlanned}`)
if (!DRY_RUN) console.log(`  Applied: ${actionsApplied}`)
console.log(`  Skipped (already correct): ${actionsSkipped}`)
if (errors.length > 0) {
  console.log(`  Errors: ${errors.length}`)
  for (const e of errors) console.log(`    - ${e}`)
}

console.log(`\n## Manual step remaining (UI only)`)
console.log(`  The GA4 Admin API does NOT expose Reporting Identity.`)
console.log(`  Click in the UI: Admin → Property settings → Data display`)
console.log(`    → Reporting identity → Blended → Save.`)
console.log(`  This activates user_id-based cross-device + User Explorer.`)
console.log(``)

process.exit(errors.length > 0 ? 1 : 0)
