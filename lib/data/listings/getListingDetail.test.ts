import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * A malformed listing key must be a MISS, never a thrown exception.
 *
 * WHY (2026-08-19). /listing/[listingKey] renders dynamically inside a
 * loading.tsx Suspense boundary, so React flushes the shell — and commits HTTP
 * 200 — before the page component resolves. Anything the page throws after that
 * point cannot change the status and is not written into the stream: the
 * visitor gets 200 with a blank body. Measured on ryan-realty.com,
 * /listing/<150 characters> returned HTTP 200 with 1,593 characters of text and
 * no <h1> — indistinguishable from the seller-opted-out listing that started
 * this fix.
 *
 * getListingDetail's contract is `ListingDetail | null`, and it throws ONLY for
 * a transient DB failure, which is the only error a retry can fix. An input
 * that can never be a listing key is a genuine miss, so it returns null and
 * lands on the same rendered refusal every other unresolvable key gets.
 *
 * This is a source assertion rather than a call, because the module's behaviour
 * here is decided before any Supabase client or Next cache is touched — an
 * import-time-free check that still fails if `safeParse` is swapped back to the
 * throwing `parse`.
 */
const SRC = readFileSync(resolve('lib/data/listings/getListingDetail.ts'), 'utf8')
// Comments in this module quote the old `InputSchema.parse(...)` call by name to
// explain why it went away, so the assertions below read CODE, not prose.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('getListingDetail input handling', () => {
  it('treats a malformed key as a miss (safeParse -> null), never a throw', () => {
    expect(CODE).toMatch(/if \(!InputSchema\.safeParse\(\{ listingKey \}\)\.success\) return null/)
  })

  it('does not call the throwing InputSchema.parse', () => {
    expect(CODE).not.toMatch(/InputSchema\.parse\(/)
  })

  it('still bounds the key length, so the miss is a decision and not an accident', () => {
    expect(SRC).toMatch(/listingKey: z\.string\(\)\.min\(1\)\.max\(100\)/)
  })

  it('keeps throwing on a transient DB failure so an error-null is never cached', () => {
    expect(SRC).toMatch(/throw new Error\(\s*`listings detail lookup failed for/)
  })
})
