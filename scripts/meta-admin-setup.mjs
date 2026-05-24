#!/usr/bin/env node
/**
 * scripts/meta-admin-setup.mjs
 *
 * Idempotent Meta (Facebook + Instagram) Admin API audit + fix.
 *
 * Companion to scripts/ga4-admin-setup.mjs. Where the GA4 script enforces
 * a property baseline, this one:
 *
 *   1. Audits every owned pixel + flags "dead" pixels that have fired
 *      recently (potential attribution leak — code somewhere is sending
 *      events to the wrong pixel id).
 *   2. Audits every lead-ad form (active vs archived + leads_count). All
 *      forms archived = no live capture surface = explains why
 *      processed_meta_leads is empty.
 *   3. Audits every campaign + ad set + ad. For ads using a click-to-
 *      website destination URL (not Lead Ads), checks if the URL carries
 *      the canonical UTM convention from docs/UTM_TRACKING_CONVENTION.md.
 *      Optionally auto-fixes missing UTMs.
 *   4. Audits webhook subscriptions on the page.
 *   5. Audits page verification status.
 *   6. Audits domain verification status on the Business Manager.
 *   7. Reports a final action checklist.
 *
 * Usage:
 *   node scripts/meta-admin-setup.mjs                 # audit only (default)
 *   node scripts/meta-admin-setup.mjs --fix-utms      # rewrite ad URLs with canonical UTMs
 *   node scripts/meta-admin-setup.mjs --include-paused # include PAUSED ads in URL fixes (default: ACTIVE only)
 *
 * Requires from .env:
 *   META_PAGE_ACCESS_TOKEN  (also: META_PAGE_TOKEN)
 *   META_AD_ACCOUNT_ID
 *   META_FB_PAGE_ID
 *   NEXT_PUBLIC_META_PIXEL_ID
 */

const FIX_UTMS = process.argv.includes('--fix-utms')
const INCLUDE_PAUSED = process.argv.includes('--include-paused')

const TOKEN = (process.env.META_PAGE_ACCESS_TOKEN || process.env.META_PAGE_TOKEN || '').trim()
const AD_ACCOUNT_ID = (process.env.META_AD_ACCOUNT_ID || '').trim()
const PAGE_ID = (process.env.META_FB_PAGE_ID || '').trim()
const PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID || '').trim()

if (!TOKEN || !AD_ACCOUNT_ID || !PAGE_ID || !PIXEL_ID) {
  console.error('Missing env: META_PAGE_ACCESS_TOKEN + META_AD_ACCOUNT_ID + META_FB_PAGE_ID + NEXT_PUBLIC_META_PIXEL_ID')
  process.exit(1)
}

const accountId = AD_ACCOUNT_ID.startsWith('act_') ? AD_ACCOUNT_ID : `act_${AD_ACCOUNT_ID}`

async function fb(path, init = {}) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://graph.facebook.com/v21.0/${path}${sep}access_token=${encodeURIComponent(TOKEN)}`
  const res = await fetch(url, init)
  const body = await res.text()
  let parsed
  try { parsed = JSON.parse(body) } catch { parsed = body }
  return { status: res.status, ok: res.ok, body: parsed }
}

const issues = []
const actions = []

console.log(`\n${'='.repeat(64)}`)
console.log(`Meta Admin Audit — Page ${PAGE_ID} · Pixel ${PIXEL_ID}`)
console.log(`Mode: ${FIX_UTMS ? 'AUDIT + FIX URL UTMS' : 'AUDIT ONLY'}`)
console.log('='.repeat(64))

// ─── 1. Pixel inventory ───────────────────────────────────────────────────
console.log('\n## Owned pixels')
const pageRes = await fb(`${PAGE_ID}?fields=business`)
const businessId = pageRes.body.business?.id
if (!businessId) {
  console.log('  (could not resolve business id from page)')
} else {
  const pixelsRes = await fb(`${businessId}/owned_pixels?fields=id,name,is_unavailable,last_fired_time`)
  for (const p of pixelsRes.body.data ?? []) {
    const isCanonical = String(p.id) === String(PIXEL_ID)
    const lastFired = p.last_fired_time
    const daysAgo = lastFired ? Math.floor((Date.now() - new Date(lastFired).getTime()) / 86400000) : null
    const dead = !isCanonical && (daysAgo === null || daysAgo > 30)
    const leaking = !isCanonical && daysAgo !== null && daysAgo <= 30
    const tag = isCanonical ? '✓ CANONICAL' : leaking ? '⚠️ STILL FIRING' : dead ? '○ truly dead' : ''
    console.log(`  ${p.name} (${p.id}) ${tag}`)
    console.log(`    last_fired: ${lastFired || '(never)'} ${daysAgo !== null ? `(${daysAgo}d ago)` : ''}`)
    if (leaking) {
      issues.push(`pixel ${p.id} (${p.name}) fired ${daysAgo}d ago — investigate where (search code for that pixel id)`)
    }
  }
}

// ─── 2. Lead-ad form inventory ────────────────────────────────────────────
console.log('\n## Lead-ad forms')
const formsRes = await fb(`${PAGE_ID}/leadgen_forms?fields=id,name,status,leads_count,locale,follow_up_action_url&limit=50`)
const forms = formsRes.body.data ?? []
const active = forms.filter((f) => f.status === 'ACTIVE')
const archived = forms.filter((f) => f.status !== 'ACTIVE')
console.log(`  total: ${forms.length} (active: ${active.length}, archived: ${archived.length})`)
for (const f of forms) {
  console.log(`  - "${f.name}" (${f.id}) status=${f.status} leads_count=${f.leads_count}`)
}
if (active.length === 0) {
  issues.push('NO ACTIVE LEAD FORMS — no campaign can capture leads until you create one in Ads Manager → Page → Publishing Tools → Lead Forms')
}

// ─── 3. Webhook subscription ──────────────────────────────────────────────
console.log('\n## Webhook subscription')
const subsRes = await fb(`${PAGE_ID}/subscribed_apps?fields=id,name,subscribed_fields,category`)
for (const s of subsRes.body.data ?? []) {
  const hasLeadgen = (s.subscribed_fields ?? []).includes('leadgen')
  console.log(`  ${s.name} (${s.id}) — leadgen=${hasLeadgen ? '✓' : '✗'} fields=[${(s.subscribed_fields ?? []).join(', ')}]`)
  if (!hasLeadgen) {
    issues.push(`webhook app ${s.name} (${s.id}) is NOT subscribed to leadgen — re-subscribe in Meta App Dashboard`)
  }
}

// ─── 4. Page verification ─────────────────────────────────────────────────
console.log('\n## Page verification')
const pageVer = await fb(`${PAGE_ID}?fields=id,name,verification_status,about,website`)
console.log(`  verification_status: ${pageVer.body.verification_status || '(not set)'}`)
console.log(`  website: ${pageVer.body.website || '(not set)'}`)
if (pageVer.body.verification_status !== 'blue_verified' && pageVer.body.verification_status !== 'gray_verified') {
  issues.push('Facebook Page is not verified. Apply via Meta Business Suite → Settings → Page Setup → Page Verification (optional but useful).')
}

// ─── 5. Domain verification on Business Manager ───────────────────────────
console.log('\n## Domain verification (Business Manager)')
if (businessId) {
  // The owned_domains field doesn't exist on Business — use /verified_domains
  const domsRes = await fb(`${businessId}?fields=verified_domains{verified_domain,verification_status}`)
  const verifiedDomains = domsRes.body.verified_domains?.data ?? domsRes.body.verified_domains ?? []
  if (Array.isArray(verifiedDomains) && verifiedDomains.length > 0) {
    for (const d of verifiedDomains) {
      console.log(`  - ${d.verified_domain || d.domain_name || JSON.stringify(d).slice(0, 80)}: ${d.verification_status || '?'}`)
    }
  } else {
    // Fallback: try direct GET against business endpoint
    console.log(`  (verified_domains field unavailable via this endpoint; check Business Manager UI: business.facebook.com/settings/owned-domains?business_id=${businessId})`)
    actions.push(`Verify ryan-realty.com is listed at https://business.facebook.com/settings/owned-domains?business_id=${businessId}. Domain verification meta tag is already in app/layout.tsx: u2o7h6orbfu10vsgp4rmihm91j3atf`)
  }
}

// ─── 6. Campaign / ad inventory + URL audit ───────────────────────────────
console.log('\n## Campaigns + ads (URL audit)')
const campaignsRes = await fb(`${accountId}/campaigns?fields=id,name,objective,status,effective_status&limit=50`)
const campaigns = campaignsRes.body.data ?? []
console.log(`  total campaigns: ${campaigns.length}`)

let totalUrlAds = 0
let urlsFixed = 0
let urlsAlreadyTagged = 0
let leadAdAds = 0
let pausedAdsSkipped = 0

const REQUIRED_UTMS = ['utm_source', 'utm_medium', 'utm_campaign']

function buildCanonicalUrl(originalUrl, campaignName, adName, adSetName) {
  const u = new URL(originalUrl)
  // Slugify the campaign + ad set + ad names for the UTM params.
  const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  // Don't overwrite if a value is already set; only fill gaps.
  if (!u.searchParams.get('utm_source')) u.searchParams.set('utm_source', 'facebook')
  if (!u.searchParams.get('utm_medium')) u.searchParams.set('utm_medium', 'paid_social')
  if (!u.searchParams.get('utm_campaign')) u.searchParams.set('utm_campaign', slug(campaignName))
  if (!u.searchParams.get('utm_content')) u.searchParams.set('utm_content', slug(adSetName))
  if (!u.searchParams.get('utm_term')) u.searchParams.set('utm_term', slug(adName))
  return u.toString()
}

for (const c of campaigns) {
  const adSetsRes = await fb(`${c.id}/adsets?fields=id,name,status,effective_status&limit=50`)
  for (const adSet of adSetsRes.body.data ?? []) {
    const adsRes = await fb(`${adSet.id}/ads?fields=id,name,status,effective_status,creative{object_url,link_url,object_story_spec,asset_feed_spec}&limit=50`)
    for (const ad of adsRes.body.data ?? []) {
      const cre = ad.creative ?? {}
      const url = cre.object_url || cre.link_url || cre.object_story_spec?.link_data?.link || cre.asset_feed_spec?.link_urls?.[0]?.website_url
      const isLeadAd = !url || url.startsWith('http://fb.me/') || url === 'https://fb.me/'
      if (isLeadAd) {
        leadAdAds++
        continue
      }
      totalUrlAds++
      const skip = !INCLUDE_PAUSED && (ad.effective_status === 'PAUSED' || ad.effective_status === 'CAMPAIGN_PAUSED' || ad.effective_status === 'ADSET_PAUSED' || ad.status === 'PAUSED')
      if (skip) {
        pausedAdsSkipped++
        continue
      }
      let needsFix = false
      try {
        const u = new URL(url)
        for (const k of REQUIRED_UTMS) {
          if (!u.searchParams.get(k)) { needsFix = true; break }
        }
      } catch { needsFix = true }
      if (!needsFix) {
        urlsAlreadyTagged++
        continue
      }
      console.log(`  ⚡ MISSING UTMs: "${ad.name}" → ${url}`)
      if (FIX_UTMS) {
        const fixedUrl = buildCanonicalUrl(url, c.name, ad.name, adSet.name)
        // Update via PUT to the ad creative — Meta requires a new creative for changes;
        // for safe in-place edits we can update object_url on the creative when supported.
        const updRes = await fb(`${ad.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creative: { object_url: fixedUrl } }),
        })
        if (updRes.ok) {
          console.log(`     ✓ FIXED → ${fixedUrl}`)
          urlsFixed++
        } else {
          console.log(`     ✗ FIX FAILED HTTP ${updRes.status}: ${JSON.stringify(updRes.body).slice(0, 200)}`)
          issues.push(`ad ${ad.id} URL update failed: ${updRes.body?.error?.message || 'unknown error'}`)
        }
      }
    }
  }
}
console.log(`\n  URL ads: ${totalUrlAds} (lead-ad form ads skipped: ${leadAdAds})`)
console.log(`  already tagged: ${urlsAlreadyTagged}`)
console.log(`  paused + skipped: ${pausedAdsSkipped}`)
if (FIX_UTMS) console.log(`  fixed this run: ${urlsFixed}`)

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(64)}`)
console.log('Summary')
console.log('='.repeat(64))
if (issues.length > 0) {
  console.log('\n## Issues found')
  for (const i of issues) console.log(`  - ${i}`)
}
if (actions.length > 0) {
  console.log('\n## Manual actions')
  for (const a of actions) console.log(`  - ${a}`)
}
if (issues.length === 0 && actions.length === 0) {
  console.log('\n  ✓ No issues found.')
}

process.exit(0)
