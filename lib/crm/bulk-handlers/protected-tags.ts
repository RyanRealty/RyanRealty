/**
 * Protected compliance tags — the bulk tag handlers' load-bearing safety rail.
 *
 * A bulk add-tag / remove-tag MUST NEVER touch a tag that drives a suppression.
 * Removing `compliance:hard-stop` (or any do-not-text / do-not-call / unsubscribe
 * flag) in bulk would silently un-suppress a contact across 18K rows — a TCPA /
 * CAN-SPAM incident at scale. Adding one in bulk is equally dangerous (a fat-finger
 * hard-stops the whole book). Both are refused per-contact and counted as skipped.
 *
 * The authoritative set is the SAME mapping isSuppressed enforces at send time
 * (lib/crm/suppressions.ts TAG_CHANNEL) — one source, never a second copy that can
 * drift. This module is PURE (no I/O) so it is unit-testable and importable from
 * the handlers without pulling in 'server-only'.
 */

import { TAG_CHANNEL } from '@/lib/crm/suppressions'

/** Lower-cased set of every tag that drives a suppression channel. */
const PROTECTED_TAGS: ReadonlySet<string> = new Set(
  TAG_CHANNEL.map((m) => m.tag.toLowerCase()),
)

/**
 * True when a tag is a protected compliance tag (case-insensitive). Bulk tag
 * mutations refuse to add or remove any tag for which this returns true.
 */
export function isProtectedComplianceTag(tag: string): boolean {
  return PROTECTED_TAGS.has(tag.trim().toLowerCase())
}

/** The protected tags, lower-cased and sorted — exported for tests + diagnostics. */
export function listProtectedComplianceTags(): string[] {
  return [...PROTECTED_TAGS].sort()
}
