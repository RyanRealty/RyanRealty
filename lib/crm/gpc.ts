/**
 * lib/crm/gpc.ts -- PURE Global Privacy Control (GPC) consent decisions
 * (CONTACT360 Phase 8.1).
 *
 * GPC is the browser-level "do not sell / share" signal (the Sec-GPC request
 * header set to "1", and the parallel navigator.globalPrivacyControl JS flag).
 * California (CCPA/CPRA), Colorado, and Connecticut treat a GPC signal as a
 * legally binding opt-out of sale/sharing -- which, for us, means: stop
 * cross-context tracking AND exclude the person from any data we hand to Meta
 * (Custom Audiences, CAPI personalization). This file is the PURE decision
 * surface (no I/O, no env, no DB) so the two decisions are unit-testable and
 * reused by every consumer (the visitor tracker, the CAPI route, the uploader).
 *
 * Two decisions:
 *   1. isGpcOptOut(signal) -- did THIS request carry a GPC opt-out?
 *   2. shouldExcludeFromSharing(suppressions) -- is THIS person already opted
 *      out (any suppression row counts) so their data must not be shared?
 *
 * Wiring lives elsewhere (the route records a crm_suppressions row; the
 * uploader's eligible-read excludes anyone suppressed). This file decides
 * only -- it never writes.
 */

/**
 * The raw GPC signal a request can carry. Both forms are checked because a
 * browser may set the Sec-GPC header (server-visible) and/or expose the JS
 * flag (client-visible, forwarded in the body).
 *
 * - secGpcHeader: the value of the `Sec-GPC` request header. "1" means opt-out.
 * - jsFlag: navigator.globalPrivacyControl as forwarded by the client. true
 *   means opt-out.
 */
export type GpcSignal = {
  secGpcHeader?: string | null
  jsFlag?: boolean | null
}

/**
 * True when the request carries a GPC opt-out: the Sec-GPC header is exactly
 * "1" OR the forwarded JS flag is exactly true. Anything else (unset, "0",
 * "true" string, false, null) is NOT an opt-out -- the spec defines the header
 * value as the single ASCII "1" and the JS property as a boolean true.
 */
export function isGpcOptOut(signal: GpcSignal): boolean {
  if (signal.secGpcHeader != null && signal.secGpcHeader.trim() === '1') return true
  if (signal.jsFlag === true) return true
  return false
}

/**
 * True when a person must be excluded from any data sharing (Meta audiences,
 * CAPI personalization) because they carry AT LEAST ONE suppression row. This
 * mirrors the audience reader's posture exactly: ANY suppression -- on ANY
 * channel, for ANY reason (a GPC opt-out, a hard-stop, an unsubscribe) -- pulls
 * the person from sharing entirely. An empty/absent list means "no suppression
 * on record" and does NOT, on its own, prove consent -- it just means this
 * particular gate has nothing to exclude on.
 *
 * @param suppressions whatever suppression rows are on record for the person.
 *   Only the count matters here (any row -> exclude), so the element shape is
 *   intentionally loose.
 */
export function shouldExcludeFromSharing(
  suppressions: ReadonlyArray<unknown> | null | undefined,
): boolean {
  return Array.isArray(suppressions) && suppressions.length > 0
}
