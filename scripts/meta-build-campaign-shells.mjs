#!/usr/bin/env node
/**
 * scripts/meta-build-campaign-shells.mjs
 *
 * Builds the canonical 6-tier paid retargeting structure on Meta as PAUSED shells.
 *
 *   Tier 1 — Database Nurture (Awareness, $12/day) — RR FUB Targetable
 *   Tier 2A — Bend Resident TOFU (Leads, $12/day) — interests + LAL, cold acquisition
 *   Tier 2B — West Bend 97703 Premium TOFU (Leads, $7/day) — 97703 MLS owners + LAL
 *   Tier 3 — Out-of-Area Absentee (Leads, $5/day) — Absentee MLS, CA/WA/OR
 *   Tier 4 — MOFU Retargeting (Leads, $10/day) — Seller LP visitors 180d
 *   Tier 5 — BOFU Hot (Leads, $3/day) — Seller LP visitors 14d
 *
 * Prerequisites this script also creates if missing:
 *   - AUD-CORE-Sellers-180d (WCA, pixel, seller LP url contains, 180d, exclude Lead converters)
 *   - AUD-CORE-Sellers-14d (WCA, same url filter, 14d window)
 *   - AUD-CORE-Converters-365d (WCA, Lead event, 365d)
 *   - AUD-LAL-1pct-Targetable (Lookalike of RR Database — Targetable, US 1%)
 *
 * Hard rules:
 *   - Every campaign: special_ad_categories: ['HOUSING'] (real estate is Special Ad Category)
 *   - Every campaign: status PAUSED (Matt activates manually after attaching creative)
 *   - Every ad set: minimum 15mi radius for any geo (HOUSING constraint)
 *   - Every ad set: age 18-65 only (HOUSING constraint), no gender targeting
 *   - Every ad set: excludes RR FUB Hard-Stop + AUD-CORE-Converters-365d
 *   - No creative attached (no ad creatives, no Lead Forms wired up)
 *
 * Idempotent: re-running finds existing audiences/campaigns/ad sets by name and skips create.
 *
 * Usage:
 *   vercel env pull /tmp/.env --environment=production --yes
 *   set -a && source /tmp/.env && set +a
 *   node scripts/meta-build-campaign-shells.mjs --dry-run    # preview only
 *   node scripts/meta-build-campaign-shells.mjs              # apply
 *   rm /tmp/.env
 */

const DRY_RUN = process.argv.includes('--dry-run')

const META_TOKEN = (process.env.META_PAGE_ACCESS_TOKEN || '').trim()
const AD_ACCT_RAW = (process.env.META_AD_ACCOUNT_ID || '').trim()
const PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID || '1546878946032105').trim()
if (!META_TOKEN || !AD_ACCT_RAW) {
  console.error('Missing env: META_PAGE_ACCESS_TOKEN, META_AD_ACCOUNT_ID required.')
  process.exit(1)
}
const AD_ACCT = AD_ACCT_RAW.startsWith('act_') ? AD_ACCT_RAW : `act_${AD_ACCT_RAW}`

// ─── Known audience IDs (live in Meta, verified 2026-05-26) ─────────────────
const AUD = {
  fubTargetable: '120244223033600698',           // RR Database — Targetable (10,164 contacts)
  fubHardStop:   '120244223042110698',           // RR FUB Hard-Stop Exclusion (3,023 contacts)
  mlsBendAll:    '120244161522810698',           // RR MLS — Bend Property Owners (all) 9,058
  mls97703:      '120244161526200698',           // RR MLS — 97703 Property Owners 7,178
  mlsAbsentee:   '120244161528410698',           // RR MLS — Absentee Owners (Bend area) 1,619
}

// Seller LP path filters (all URLs we treat as a seller-intent visit)
const SELLER_LP_PATHS = [
  '/lp/seller-home-value',
  '/home-valuation',
  '/sell/valuation',
  '/sell/plan',
  '/sell',
  '/lp/expired-listing',
  '/lp/tetherow/heath',
]

// ─── Generic Meta caller ────────────────────────────────────────────────────
async function meta(method, path, body) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://graph.facebook.com/v21.0/${path}${sep}access_token=${encodeURIComponent(META_TOKEN)}`
  const init = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  const r = await fetch(url, init)
  const text = await r.text()
  let parsed; try { parsed = JSON.parse(text) } catch { parsed = text }
  return { status: r.status, ok: r.ok, body: parsed }
}

// ─── Find-or-create helpers ─────────────────────────────────────────────────

async function findAudience(name) {
  const list = await meta('GET', `${AD_ACCT}/customaudiences?fields=id,name,subtype&limit=500`)
  const data = list.body?.data ?? []
  return data.find(a => a.name === name) || null
}

async function findCampaign(name) {
  const list = await meta('GET', `${AD_ACCT}/campaigns?fields=id,name,status&limit=200`)
  const data = list.body?.data ?? []
  return data.find(c => c.name === name) || null
}

async function findAdSet(campaignId, name) {
  // Meta's /adsets endpoint defaults to filtering out non-active sets unless you
  // pass an effective_status filter explicitly. Without this filter, find returns
  // empty and we end up creating duplicates on every re-run.
  const filter = encodeURIComponent(JSON.stringify([
    { field: 'effective_status', operator: 'IN', value: ['PAUSED', 'ACTIVE', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'] },
  ]))
  const list = await meta('GET', `${campaignId}/adsets?fields=id,name,status&limit=50&filtering=${filter}`)
  if (!list.ok) {
    // Fail loud: if we can't list ad sets, do NOT assume "none exist" — that
    // path silently creates duplicates on rate-limit / network errors.
    throw new Error(`findAdSet GET failed for campaign ${campaignId}: ${JSON.stringify(list.body).slice(0, 300)}`)
  }
  const data = list.body?.data ?? []
  return data.find(s => s.name === name) || null
}

// ─── Audience rule builders ─────────────────────────────────────────────────

function sellerLpInclusionRule(retentionDays) {
  return {
    inclusions: {
      operator: 'or',
      rules: [
        {
          event_sources: [{ id: PIXEL_ID, type: 'pixel' }],
          retention_seconds: retentionDays * 86400,
          filter: {
            operator: 'or',
            filters: SELLER_LP_PATHS.map(p => ({
              field: 'url',
              operator: 'i_contains',
              value: p,
            })),
          },
        },
      ],
    },
    exclusions: {
      operator: 'or',
      rules: [
        {
          event_sources: [{ id: PIXEL_ID, type: 'pixel' }],
          retention_seconds: 365 * 86400,
          filter: {
            operator: 'and',
            filters: [
              { field: 'event', operator: '=', value: 'Lead' },
            ],
          },
        },
      ],
    },
  }
}

function converterRule(retentionDays) {
  return {
    inclusions: {
      operator: 'or',
      rules: [
        {
          event_sources: [{ id: PIXEL_ID, type: 'pixel' }],
          retention_seconds: retentionDays * 86400,
          filter: {
            operator: 'and',
            filters: [
              { field: 'event', operator: '=', value: 'Lead' },
            ],
          },
        },
      ],
    },
  }
}

// ─── Create WCAs + LAL ──────────────────────────────────────────────────────

async function ensureWebsiteAudience(name, description, rule, retentionDays) {
  const existing = await findAudience(name)
  if (existing) {
    console.log(`  ✓ Found existing WCA "${name}" (${existing.id})`)
    return existing.id
  }
  if (DRY_RUN) {
    console.log(`  [dry] Would create WCA "${name}" retention=${retentionDays}d`)
    return `dry-${name.replace(/\s+/g, '-')}`
  }
  const create = await meta('POST', `${AD_ACCT}/customaudiences`, {
    name,
    description,
    retention_days: retentionDays,
    rule: JSON.stringify(rule),
    prefill: 1,
  })
  if (!create.ok) {
    throw new Error(`WCA create failed for "${name}": ${JSON.stringify(create.body).slice(0, 300)}`)
  }
  console.log(`  ✓ Created WCA "${name}" (${create.body.id})`)
  return create.body.id
}

async function ensureLookalike(name, description, originAudienceId, ratio = 0.01) {
  const existing = await findAudience(name)
  if (existing) {
    console.log(`  ✓ Found existing LAL "${name}" (${existing.id})`)
    return existing.id
  }
  if (DRY_RUN) {
    console.log(`  [dry] Would create LAL "${name}" origin=${originAudienceId} ratio=${ratio}`)
    return `dry-${name.replace(/\s+/g, '-')}`
  }
  const create = await meta('POST', `${AD_ACCT}/customaudiences`, {
    name,
    description,
    subtype: 'LOOKALIKE',
    origin_audience_id: originAudienceId,
    lookalike_spec: {
      type: 'similarity',
      ratio,
      country: 'US',
    },
  })
  if (!create.ok) {
    // Special Ad Audience may be required for HOUSING. Try again with that flag.
    const retry = await meta('POST', `${AD_ACCT}/customaudiences`, {
      name,
      description,
      subtype: 'LOOKALIKE',
      origin_audience_id: originAudienceId,
      lookalike_spec: {
        type: 'similarity',
        ratio,
        country: 'US',
        is_financial_service: false,
      },
    })
    if (!retry.ok) {
      console.warn(`  ! LAL create failed for "${name}":`)
      console.warn(`    first try:  ${JSON.stringify(create.body).slice(0, 240)}`)
      console.warn(`    retry:      ${JSON.stringify(retry.body).slice(0, 240)}`)
      console.warn(`    Falling back: campaigns will be built WITHOUT LAL targeting.`)
      return null
    }
    console.log(`  ✓ Created LAL "${name}" (${retry.body.id}) [via retry]`)
    return retry.body.id
  }
  console.log(`  ✓ Created LAL "${name}" (${create.body.id})`)
  return create.body.id
}

// ─── Campaign + Ad Set creation ─────────────────────────────────────────────

async function ensureCampaign(name, objective) {
  const existing = await findCampaign(name)
  if (existing) {
    console.log(`  ✓ Found existing campaign "${name}" (${existing.id}) status=${existing.status}`)
    return existing.id
  }
  if (DRY_RUN) {
    console.log(`  [dry] Would create campaign "${name}" objective=${objective} HOUSING PAUSED`)
    return `dry-camp-${name.replace(/\s+/g, '-')}`
  }
  const create = await meta('POST', `${AD_ACCT}/campaigns`, {
    name,
    objective,
    status: 'PAUSED',
    special_ad_categories: ['HOUSING'],
    buying_type: 'AUCTION',
    is_adset_budget_sharing_enabled: false,
  })
  if (!create.ok) {
    throw new Error(`Campaign create failed for "${name}": ${JSON.stringify(create.body).slice(0, 400)}`)
  }
  console.log(`  ✓ Created campaign "${name}" (${create.body.id})`)
  return create.body.id
}

async function ensureAdSet(campaignId, name, spec) {
  if (typeof campaignId === 'string' && campaignId.startsWith('dry-')) {
    if (DRY_RUN) {
      console.log(`  [dry] Would create ad set "${name}" daily_budget=$${(spec.daily_budget_cents/100).toFixed(2)} freq_cap=${spec.frequency_cap || 'none'}`)
      return `dry-as-${name.replace(/\s+/g, '-')}`
    }
  }
  const existing = campaignId.startsWith('dry-') ? null : await findAdSet(campaignId, name)
  if (existing) {
    console.log(`  ✓ Found existing ad set "${name}" (${existing.id}) status=${existing.status}`)
    return existing.id
  }
  if (DRY_RUN) {
    console.log(`  [dry] Would create ad set "${name}" daily_budget=$${(spec.daily_budget_cents/100).toFixed(2)} freq_cap=${spec.frequency_cap || 'none'}`)
    return `dry-as-${name.replace(/\s+/g, '-')}`
  }

  const body = {
    name,
    campaign_id: campaignId,
    status: 'PAUSED',
    daily_budget: spec.daily_budget_cents,
    billing_event: spec.billing_event || 'IMPRESSIONS',
    optimization_goal: spec.optimization_goal,
    bid_strategy: spec.bid_strategy || 'LOWEST_COST_WITHOUT_CAP',
    targeting: spec.targeting,
    // Start tomorrow so we don't accidentally start spending if anything is misset
    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
  if (spec.optimization_goal === 'OFFSITE_CONVERSIONS') {
    body.promoted_object = { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' }
  }
  if (spec.frequency_cap) {
    body.frequency_control_specs = [
      { event: 'IMPRESSIONS', interval_days: 7, max_frequency: spec.frequency_cap },
    ]
  }
  // Destination is web for awareness + offsite conversions
  body.destination_type = 'WEBSITE'

  const create = await meta('POST', `${AD_ACCT}/adsets`, body)
  if (!create.ok) {
    throw new Error(`Ad set create failed for "${name}": ${JSON.stringify(create.body).slice(0, 500)}`)
  }
  console.log(`  ✓ Created ad set "${name}" (${create.body.id})`)
  return create.body.id
}

// ─── Targeting templates ────────────────────────────────────────────────────

const HOUSING_BASE = {
  age_min: 18,
  age_max: 65,
  geo_locations: { location_types: ['home', 'recent'] },
  targeting_relaxation_types: { lookalike: 0, custom_audience: 0 },
}

function bendCity25mi() {
  return {
    custom_locations: [
      // Bend OR centroid
      { latitude: 44.0582, longitude: -121.3153, radius: 25, distance_unit: 'mile', address_string: 'Bend, OR' },
    ],
    location_types: ['home', 'recent'],
  }
}

function bend97703_15mi() {
  return {
    custom_locations: [
      { latitude: 44.082, longitude: -121.333, radius: 15, distance_unit: 'mile', address_string: '97703 — West Bend' },
    ],
    location_types: ['home', 'recent'],
  }
}

function outOfArea() {
  return {
    regions: [
      { key: '3847' }, // California (verified via /search?type=adgeolocation)
      { key: '3890' }, // Washington
      { key: '3880' }, // Oregon (Bend excluded via targeting.excluded_geo_locations below)
    ],
    location_types: ['home'],
  }
}

function bendExclusion() {
  return {
    custom_locations: [
      { latitude: 44.0582, longitude: -121.3153, radius: 25, distance_unit: 'mile', address_string: 'Bend, OR — excluded' },
    ],
    location_types: ['home', 'recent'],
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

console.log(`${'='.repeat(72)}`)
console.log(`Meta — Build 6-tier campaign shells`)
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`)
console.log(`Ad account: ${AD_ACCT}    Pixel: ${PIXEL_ID}`)
console.log(`${'='.repeat(72)}\n`)

console.log('## Step 1 — Ensure prerequisite audiences exist')
const sellers180Id = await ensureWebsiteAudience(
  'AUD-CORE-Sellers-180d',
  'Visitors to any seller LP path in the last 180 days. Excludes anyone who fired a Lead event in the last 365d.',
  sellerLpInclusionRule(180),
  180,
)
const sellers14Id = await ensureWebsiteAudience(
  'AUD-CORE-Sellers-14d',
  'Visitors to any seller LP path in the last 14 days (BOFU hot window).',
  sellerLpInclusionRule(14),
  14,
)
const converters365Id = await ensureWebsiteAudience(
  'AUD-CORE-Converters-365d',
  'Anyone who fired a Lead event on the canonical pixel in the last 365 days. Universal exclusion.',
  converterRule(365),
  365,
)
const lalTargetable = await ensureLookalike(
  'AUD-LAL-1pct-Targetable',
  'Lookalike (US 1%) of RR Database — Targetable. Cold acquisition for Tier 2A.',
  AUD.fubTargetable,
  0.01,
)

const tier1Excludes = [AUD.fubHardStop, converters365Id].filter(Boolean)
const universalExcludesPlusFub = [AUD.fubHardStop, converters365Id, AUD.fubTargetable].filter(Boolean)

console.log('\n## Step 2 — Build the 6 campaigns + ad sets\n')

const results = {}
async function tier(label, body) {
  try {
    await body()
    results[label] = 'ok'
  } catch (err) {
    results[label] = `FAILED: ${err.message?.slice(0, 300) || err}`
    console.error(`  ✗ ${label} failed:`, err.message?.slice(0, 400) || err)
  }
}

// ─── Tier 1 — Database Nurture (Awareness) ─────────────────────────────────
console.log('### Tier 1 — Database Nurture')
let t1campId, t1asId
await tier('Tier 1', async () => {
  t1campId = await ensureCampaign('RR — Tier 1 — Database Nurture (Sphere)', 'OUTCOME_AWARENESS')
  t1asId = await ensureAdSet(t1campId, 'RR — T1 — Database Nurture — AdSet 1', {
  daily_budget_cents: 1200,
  optimization_goal: 'REACH',
  bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
  frequency_cap: 3,
  targeting: {
    ...HOUSING_BASE,
    geo_locations: bendCity25mi(),
    custom_audiences: [{ id: AUD.fubTargetable }],
    excluded_custom_audiences: tier1Excludes.map(id => ({ id })),
  },
  })
})

// ─── Tier 2A — Bend Resident TOFU (Leads) ──────────────────────────────────
console.log('\n### Tier 2A — Bend Resident TOFU')
let t2aCampId, t2aAsId
await tier('Tier 2A', async () => {
  t2aCampId = await ensureCampaign('RR — Tier 2A — Bend Resident TOFU', 'OUTCOME_LEADS')
// HOUSING Special Ad Category restricts detailed targeting (interests / behaviors
// that could be proxies for protected classes). Tier 2A runs broad on geo +
// exclusions only — Meta Advantage+ optimizes from there. Interest-layering can
// be added back in the UI once Matt picks HOUSING-eligible interest IDs.
const t2aTargeting = {
  ...HOUSING_BASE,
  geo_locations: bendCity25mi(),
  excluded_custom_audiences: universalExcludesPlusFub.map(id => ({ id })),
}
// HOUSING Special Ad Category disallows standard Lookalikes. The placeholder LAL
// we created (subtype LOOKALIKE) won't validate inside a HOUSING ad set — Meta
// requires a "Special Ad Audience" flavor which has its own creation flow not yet
// scripted. Tier 2A runs on interests + geo only; once Special Ad Audience LAL
// is created (UI or future script), wire it in here.
  t2aAsId = await ensureAdSet(t2aCampId, 'RR — T2A — Bend Resident TOFU — AdSet 1', {
    daily_budget_cents: 1200,
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: t2aTargeting,
  })
})

// ─── Tier 2B — West Bend 97703 Premium TOFU ────────────────────────────────
console.log('\n### Tier 2B — West Bend 97703 Premium TOFU')
let t2bCampId, t2bAsId
await tier('Tier 2B', async () => {
  t2bCampId = await ensureCampaign('RR — Tier 2B — West Bend 97703 Premium TOFU', 'OUTCOME_LEADS')
const t2bTargeting = {
  ...HOUSING_BASE,
  geo_locations: bend97703_15mi(),
  custom_audiences: [{ id: AUD.mls97703 }],
  excluded_custom_audiences: [AUD.fubHardStop, converters365Id].filter(Boolean).map(id => ({ id })),
}
  t2bAsId = await ensureAdSet(t2bCampId, 'RR — T2B — 97703 MLS Owners — AdSet 1', {
    daily_budget_cents: 700,
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: t2bTargeting,
  })
})

// ─── Tier 3 — Out-of-Area Absentee Owner ───────────────────────────────────
console.log('\n### Tier 3 — Out-of-Area Absentee Owner')
let t3CampId, t3AsId
await tier('Tier 3', async () => {
  t3CampId = await ensureCampaign('RR — Tier 3 — Out-of-Area Absentee Owner', 'OUTCOME_LEADS')
// HOUSING Special Ad Category bans location exclusions (#2909046). The Absentee
// MLS audience is already defined as "mailing city ≠ site city" — i.e. owners
// who live OUTSIDE Bend — so the audience filter does the work of excluding
// Bend residents. We don't need geo-level exclusion.
const t3Targeting = {
  ...HOUSING_BASE,
  geo_locations: outOfArea(),
  custom_audiences: [{ id: AUD.mlsAbsentee }],
  excluded_custom_audiences: [AUD.fubHardStop, converters365Id].filter(Boolean).map(id => ({ id })),
}
  t3AsId = await ensureAdSet(t3CampId, 'RR — T3 — Absentee MLS Owners — AdSet 1', {
    daily_budget_cents: 500,
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: t3Targeting,
  })
})

// ─── Tier 4 — MOFU Retargeting ─────────────────────────────────────────────
console.log('\n### Tier 4 — MOFU Retargeting (seller-LP visitors 180d)')
let t4CampId, t4AsId
await tier('Tier 4', async () => {
  t4CampId = await ensureCampaign('RR — Tier 4 — MOFU Retargeting (Sellers 180d)', 'OUTCOME_LEADS')
const t4Targeting = {
  ...HOUSING_BASE,
  geo_locations: bendCity25mi(),
  custom_audiences: sellers180Id && !String(sellers180Id).startsWith('dry-') ? [{ id: sellers180Id }] : [],
  excluded_custom_audiences: [AUD.fubHardStop, converters365Id].filter(Boolean).map(id => ({ id })),
}
  t4AsId = await ensureAdSet(t4CampId, 'RR — T4 — Sellers 180d — AdSet 1', {
    daily_budget_cents: 1000,
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: t4Targeting,
  })
})

// ─── Tier 5 — BOFU Hot ─────────────────────────────────────────────────────
console.log('\n### Tier 5 — BOFU Hot (seller-LP visitors 14d)')
let t5CampId, t5AsId
await tier('Tier 5', async () => {
  t5CampId = await ensureCampaign('RR — Tier 5 — BOFU Hot (Sellers 14d)', 'OUTCOME_LEADS')
const t5Targeting = {
  ...HOUSING_BASE,
  geo_locations: bendCity25mi(),
  custom_audiences: sellers14Id && !String(sellers14Id).startsWith('dry-') ? [{ id: sellers14Id }] : [],
  excluded_custom_audiences: [AUD.fubHardStop, converters365Id].filter(Boolean).map(id => ({ id })),
}
  t5AsId = await ensureAdSet(t5CampId, 'RR — T5 — Sellers 14d — AdSet 1', {
    daily_budget_cents: 300,
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: t5Targeting,
  })
})

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(72)}`)
console.log('Summary')
console.log(`${'='.repeat(72)}`)
console.log(`Prerequisite audiences:`)
console.log(`  AUD-CORE-Sellers-180d:     ${sellers180Id}`)
console.log(`  AUD-CORE-Sellers-14d:      ${sellers14Id}`)
console.log(`  AUD-CORE-Converters-365d:  ${converters365Id}`)
console.log(`  AUD-LAL-1pct-Targetable:   ${lalTargetable || '(failed — Tier 2A built without LAL)'}`)
console.log(`\nCampaign shells (all PAUSED, all HOUSING, no creative):`)
console.log(`  Tier 1   ${results['Tier 1']}   campaign ${t1campId}    adset ${t1asId}`)
console.log(`  Tier 2A  ${results['Tier 2A']}  campaign ${t2aCampId}   adset ${t2aAsId}`)
console.log(`  Tier 2B  ${results['Tier 2B']}  campaign ${t2bCampId}   adset ${t2bAsId}`)
console.log(`  Tier 3   ${results['Tier 3']}   campaign ${t3CampId}    adset ${t3AsId}`)
console.log(`  Tier 4   ${results['Tier 4']}   campaign ${t4CampId}    adset ${t4AsId}`)
console.log(`  Tier 5   ${results['Tier 5']}   campaign ${t5CampId}    adset ${t5AsId}`)
console.log(`\nNext step: attach creative + Lead Forms or website conversion creatives, then unpause manually in Ads Manager.`)
