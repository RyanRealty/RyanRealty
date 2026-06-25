import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Seed parity for crm_newsletter_segments.
 *
 * The config-table seed MUST exactly mirror the hardcoded SEGMENTS enum in
 * app/actions/newsletter.ts (the source the DB-backed catalog replaces). This
 * test reads both files and asserts the seeded keys equal the enum literals, in
 * order, so a future edit to one without the other fails CI rather than silently
 * drifting (an orphaned subscriber segment).
 */

const ROOT = join(__dirname, '..', '..')

/** Parse the SEGMENTS const literal array out of app/actions/newsletter.ts. */
function readEnumSegments(): string[] {
  const src = readFileSync(join(ROOT, 'app', 'actions', 'newsletter.ts'), 'utf8')
  const m = src.match(/const SEGMENTS:\s*NewsletterSegment\[\]\s*=\s*\[([^\]]*)\]/)
  if (!m) throw new Error('Could not find SEGMENTS const in app/actions/newsletter.ts')
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

/** Parse the seeded (key, ...) tuples out of the migration's VALUES block. */
function readSeededKeys(): string[] {
  const src = readFileSync(
    join(ROOT, 'supabase', 'migrations', '20260625170500_crm_newsletter_segments.sql'),
    'utf8',
  )
  // Each seed row begins with ('<key>',
  return [...src.matchAll(/\(\s*'([a-z0-9-]+)'\s*,/g)].map((mm) => mm[1])
}

describe('crm_newsletter_segments seed', () => {
  it('seeds exactly the four enum segments, in enum order', () => {
    const seeded = readSeededKeys()
    const enumKeys = readEnumSegments()
    expect(enumKeys).toEqual(['general', 'buyer', 'seller', 'past-client'])
    expect(seeded).toEqual(enumKeys)
  })

  it('protects the general fallback segment', () => {
    const src = readFileSync(
      join(ROOT, 'supabase', 'migrations', '20260625170500_crm_newsletter_segments.sql'),
      'utf8',
    )
    // The general row carries the protected flag (true); the others do not.
    expect(/\(\s*'general'\s*,\s*'General'\s*,\s*0\s*,\s*true\s*\)/.test(src)).toBe(true)
    expect(/\(\s*'buyer'\s*,\s*'Buyer'\s*,\s*1\s*,\s*false\s*\)/.test(src)).toBe(true)
  })
})
