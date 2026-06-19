/**
 * G48 — tracking-policy crash-guard.
 *
 * Locks the load-bearing, privacy-compliant tracking invariants so a future
 * refactor cannot silently break ad attribution or consent compliance. Every
 * assertion maps to an adversarially-verified finding from the 2026 tracking
 * deep-research (docs/TRACKING_POLICY.md) and a concrete regression risk:
 *
 *   - Drop `ad_user_data`/`ad_personalization` from Consent Mode -> Google Ads
 *     data stops flowing after the June 15 2026 CMP-governs-consent deadline.
 *   - Drop the SHA-256 hash on the CAPI path -> raw PII (email/phone) is sent
 *     to Meta in plaintext (a compliance + match-rate failure).
 *   - Drop the shared server event_id -> browser-pixel + CAPI events double-
 *     count, degrading ad optimization.
 *   - Drop utm/fbclid capture on a lead path -> closed-loop ROAS (offline
 *     conversion upload) becomes impossible (click IDs gone).
 *   - Ungate the analytics/marketing tags -> they fire regardless of consent.
 *
 * This gate asserts what MUST stay true. It is NOT a ratchet; it has no
 * baseline. If an assertion fails, a tracking-compliance invariant regressed.
 * Outward gaps (Meta LDU for CCPA opt-out, offline-conversion upload, a
 * versioned consent record) are tracked as a backlog in docs/TRACKING_POLICY.md,
 * not enforced here, because they change live ad/tracking behavior and ship
 * only on Matt's explicit go (Draft-First / ops-explicit).
 *
 * Usage: node scripts/check-tracking-policy.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

/** Read a repo file or fail the gate with a clear message. */
function read(rel) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) {
    console.error(`✗ tracking-policy: required file missing: ${rel}`)
    console.error('  A tracking-compliance surface was deleted. See docs/TRACKING_POLICY.md.')
    process.exit(1)
  }
  return readFileSync(p, 'utf8')
}

const failures = []
function check(label, ok, why) {
  if (!ok) failures.push({ label, why })
}

// ── 1. Consent Mode v2 — all FOUR params, denied by default ──────────────────
// research: Consent Mode v2 requires analytics_storage + ad_storage +
// ad_user_data + ad_personalization (3-0). Effective 2026-06-15 the CMP's
// Consent Mode signal governs Google Ads data (2-1). Missing ad_user_data /
// ad_personalization silently kills Ads data after that date.
const ga = read('components/GoogleAnalytics.tsx')
const CM_PARAMS = ['analytics_storage', 'ad_storage', 'ad_user_data', 'ad_personalization']
const hasDefaultBlock = /gtag\(\s*['"]consent['"]\s*,\s*['"]default['"]/.test(ga)
const hasUpdateBlock = /gtag\(\s*['"]consent['"]\s*,\s*['"]update['"]/.test(ga)
check('Consent Mode v2 default block present', hasDefaultBlock,
  "GoogleAnalytics.tsx must call gtag('consent','default',{...}) before gtag.js loads.")
check('Consent Mode v2 update block present', hasUpdateBlock,
  "GoogleAnalytics.tsx must re-apply stored consent via gtag('consent','update',{...}).")
for (const p of CM_PARAMS) {
  check(`Consent Mode param "${p}" wired`, ga.includes(p),
    `GoogleAnalytics.tsx is missing the "${p}" Consent Mode v2 parameter. Dropping it breaks Google Ads/Analytics consent signalling (hard deadline 2026-06-15).`)
}
check('Consent Mode "wait_for_update" present', /wait_for_update/.test(ga),
  'GoogleAnalytics.tsx must keep wait_for_update so stored consent applies before the first ping.')

// ── 2. Consent helpers exist + gate the analytics/marketing tags ─────────────
// research: consent must gate event firing on both channels (3-0).
const banner = read('components/CookieConsentBanner.tsx')
check('hasAnalyticsConsent exported', /export\s+function\s+hasAnalyticsConsent/.test(banner),
  'CookieConsentBanner.tsx must export hasAnalyticsConsent() — the analytics consent gate.')
check('hasMarketingConsent exported', /export\s+function\s+hasMarketingConsent/.test(banner),
  'CookieConsentBanner.tsx must export hasMarketingConsent() — the marketing consent gate.')
for (const rel of ['components/GTMHead.tsx', 'components/FollowUpBossPixel.tsx']) {
  const src = read(rel)
  check(`${rel} gates on consent`, /hasAnalyticsConsent|hasMarketingConsent|hasTrackingConsent/.test(src),
    `${rel} must check a consent helper before loading its tag.`)
}
// The Meta pixel fires on all traffic by directive (2026-06-02), so CCPA/CPRA opt-out
// is honored via Limited Data Use rather than suppression (research-verified pattern
// for a US opt-out site). LDU must stay wired so opted-out visitors are excluded from
// ad targeting/personalization while still being measured.
const pixel = read('components/MetaPixel.tsx')
check('Meta pixel wires Limited Data Use (LDU)', /dataProcessingOptions/.test(pixel),
  'MetaPixel.tsx must call fbq("dataProcessingOptions", ...) so opted-out (essential-only / Do Not Sell) visitors are sent in LDU mode (CCPA/CPRA).')

// ── 3. No unhashed PII to ad platforms (Meta CAPI) ───────────────────────────
// research: PII MUST be SHA-256 hashed before transmission (3-0).
const capi = read('app/api/meta-capi/route.ts')
check('CAPI hashes PII (sha256)', /sha256|createHash|hashPII/.test(capi),
  'app/api/meta-capi/route.ts must SHA-256 hash PII before sending to Meta. Raw email/phone to graph.facebook.com is a compliance failure.')
check('CAPI sends hashed em/ph keys', /\bem:/.test(capi) && /\bph:/.test(capi),
  'app/api/meta-capi/route.ts must send the hashed em/ph keys (not raw email/phone) in user_data.')
// guard against a raw plaintext key being sent in the graph payload
const sendsRawEmailKey = /['"]?email['"]?\s*:\s*(email\b|`|['"]\$\{)/.test(capi)
check('CAPI sends no raw "email" key', !sendsRawEmailKey,
  'app/api/meta-capi/route.ts appears to send a raw "email" key. Hash it (em: hashPII(email)).')
// CAPI honors CCPA/CPRA opt-out via Limited Data Use, consistent with the pixel.
const capiLib = read('lib/meta-capi.ts')
check('CAPI supports Limited Data Use', /data_processing_options/.test(capiLib),
  'lib/meta-capi.ts must include data_processing_options (LDU) so opted-out conversions are sent in limited mode; route.ts passes the ldu flag from the consent cookie.')

// ── 4. Browser-pixel <-> CAPI dedup via one server-generated event_id ────────
// research: dedup requires the SAME server-generated event_id on both paths (3-0).
const sellerAction = read('app/lp/seller-home-value/actions.ts')
const sellerForm = read('app/lp/seller-home-value/SellerLPForm.tsx')
check('Server generates a dedup event_id', /generateEventId\s*\(|const\s+eventId\b/.test(sellerAction),
  'Seller LP action must generate a server event_id for pixel<->CAPI dedup.')
check('event_id forwarded to CAPI', /event_id\s*:\s*eventId|eventId\s*,/.test(sellerAction),
  'Seller LP action must pass the server event_id to the Meta CAPI call.')
check('event_id forwarded to browser pixel', /eventID\s*:\s*result\.eventId|eventID\s*:/.test(sellerForm),
  'SellerLPForm.tsx must pass the same server event_id to fbq(..., { eventID }) so the pixel + CAPI dedup.')

// ── 5. Click-ID + UTM capture on the lead path (enables offline ROAS upload) ─
// research: persist click IDs (fbclid/gclid) + UTMs to the lead row so offline
// conversions can be uploaded within the 90-day (gclid) / 63-day (PII EC) window (3-0).
check('Lead path captures utm + click IDs', /utm_/.test(sellerAction) && /fbclid|gclid/.test(sellerAction),
  'Seller LP action must capture utm_* + fbclid/gclid on submit so the lead can be attributed and uploaded as an offline conversion.')

// ── 6. First-party visitor identity graph (Phase 5) ──────────────────────────
// The durable first-party rr_vid cookie + the anon->known identity graph are the
// spine of cross-session attribution. If middleware stops setting rr_vid, the
// server loses its only request-time visitor id (the client session_id is not
// available on the first server request); if the identify backfill stops writing
// visitor_identity_map, anonymous browsing can never be stitched to a known
// person server-side. Lock all three legs.
const mw = read('middleware.ts')
check('Middleware sets the first-party rr_vid cookie', /rr_vid/.test(mw) && /cookies\.set\(\s*['"]rr_vid['"]/.test(mw),
  "middleware.ts must set the durable first-party rr_vid cookie (attachVidCookie) — the server-readable visitor id present on the first request.")
const track = read('app/api/visitors/track/route.ts')
check('Track route records rr_vid on the session', /rr_vid/.test(track),
  'app/api/visitors/track/route.ts must read the rr_vid cookie and persist it on visitor_sessions (links the tracked session to the durable visitor).')
const backfill = read('lib/visitor-backfill.ts')
check('Identify backfill writes the identity graph', /visitor_identity_map/.test(backfill),
  'lib/visitor-backfill.ts must upsert visitor_identity_map at identify so anonymous browsing is stitched to the known FUB person/email (anon->known graph).')

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ tracking-policy: ${failures.length} invariant(s) regressed:\n`)
  for (const f of failures) {
    console.error(`  - ${f.label}`)
    console.error(`      ${f.why}`)
  }
  console.error('\n  See docs/TRACKING_POLICY.md for the rationale + research citations.')
  process.exit(1)
}
console.log('✓ tracking-policy: consent-mode v2 (4 params), consent-gated tags, CAPI PII-hashing, pixel/CAPI dedup, lead-path click-ID capture, and the first-party rr_vid identity graph all intact.')
