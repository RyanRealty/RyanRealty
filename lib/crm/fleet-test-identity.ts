/**
 * The fleet's designated test identity (THE LOOP v1.6.x, Flow Prover lane).
 *
 * Bots may submit real forms ONLY with this identity. The pipeline recognizes
 * it at the intake chokepoint (ensureNativeLead), tags the person, suppresses
 * all outbound channels (fail-closed across every send path), skips the
 * broker-wake task and auto-enrollment, and excludes it from packet counts.
 * Same pages, same submits, same backend as a human — zero side effects.
 */

export const FLEET_TEST_TAG = 'fleet:test'

/** Any email whose local part contains this marker is the fleet identity. */
const EMAIL_MARKER = 'fleet-test'

/** Designated test phone (last-10). 500-555-01xx is a reserved fictional range. */
export const FLEET_TEST_PHONE_LAST10 = '5005550106'

export function isFleetTestEmail(email: string | null | undefined): boolean {
  const local = String(email ?? '')
    .trim()
    .toLowerCase()
    .split('@')[0]
  return local.includes(EMAIL_MARKER)
}

export function isFleetTestPhone(phone: string | null | undefined): boolean {
  const digits = String(phone ?? '').replace(/\D/g, '')
  return digits.length >= 10 && digits.slice(-10) === FLEET_TEST_PHONE_LAST10
}

export function isFleetTestIdentity(input: {
  email?: string | null
  phone?: string | null
}): boolean {
  return isFleetTestEmail(input.email) || isFleetTestPhone(input.phone)
}

export function hasFleetTestTag(tags: unknown): boolean {
  return Array.isArray(tags) && tags.includes(FLEET_TEST_TAG)
}
