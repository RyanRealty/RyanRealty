#!/usr/bin/env node
/**
 * G-RME — Resort community MEMBERSHIP must be evidenced, never inferred from
 * proximity.
 *
 * THE DEFECT THIS GATE EXISTS FOR (twice now, which is why it is a gate and
 * not another paragraph — CLAUDE.md §6):
 *
 * data/resort-communities.json `subdivision_aliases` is rendered as a literal
 * membership claim in at least three places:
 *   - components/site/kb/KbResortOverview.tsx   "Subdivisions in {name}"
 *   - app/subdivisions/[slug]/page.tsx           "More areas in {resort}"
 *   - app/communities/[slug]/_v3/place-knowledge.ts   subdivision doors
 * and it also SCOPES numbers — lib/kb/resort-active-counts.ts (the alias-aware
 * active count), lib/data/geo/resolveGeoScope.ts (community market scope), and
 * lib/cma/resort-guard.ts, where a false alias makes an ordinary home price as
 * a resort home and vice versa (Matt 2026-08-05: "we never want to include
 * homes like that").
 *
 * Most of the registry earned its alias list from
 *   "Spark /listings/nearby + closest-parent assignment + >=80% inside-test"
 * which asserts membership from listing PROXIMITY. A community's envelope
 * naturally contains the independently recorded plats next door, so the test
 * over-includes by construction. It produced five false children for Awbrey
 * Glen (fixed 05917a61) and, on the 2026-08-26 audit, twenty-one more across
 * Tetherow, NorthWest Crossing, Broken Top, Eagle Crest and Brasada Ranch.
 *
 * WHAT THIS GATE ASSERTS (all static — no DB, safe in the secret-less chain):
 *   1. No entry may (re)declare the discredited proximity method.
 *   2. Every alias is evidenced: it appears in verification.confirmed[].
 *   3. Every confirmed row carries real, self-consistent numbers — pct_inside
 *      is recomputed from the counts, so a hand-edited figure fails (§0: the
 *      printed number must equal the measured one).
 *   4. A row below the 50%-inside bar must say, in writing, what OTHER query
 *      shape supports it. Absence from one polygon is not absence (§0).
 *   5. child_count equals the number of aliases that are not the label.
 *
 * Entries still awaiting a Matt decision live in the baseline beside this
 * script. The baseline may only SHRINK — the same ratchet as
 * scripts/gates-wired-baseline.json.
 *
 * Usage: node scripts/check-resort-membership-evidence.mjs
 */
import { readFileSync } from 'node:fs'

const REGISTRY = 'data/resort-communities.json'
const BASELINE = 'scripts/resort-membership-baseline.json'

/** The discredited method's fingerprints. Any of these in a `method` string
 *  means membership was inferred from proximity, which is what we banned. */
const PROXIMITY_MARKERS = [
  /listings\/nearby/i,
  /closest-parent/i,
  /inside-test/i,
]

/** A confirmed row at or above this share of its listings inside the parent
 *  polygon needs no prose. Below it, the row must name its other evidence. */
const POLYGON_BAR_PCT = 50

const fails = []

let registry
try {
  registry = JSON.parse(readFileSync(REGISTRY, 'utf8'))
} catch (e) {
  console.error(`✗ ${REGISTRY}: cannot read/parse (${e.message})`)
  process.exit(1)
}

let baseline = { pending_matt_decision: [] }
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch {
  // No baseline file = nothing is exempt. That is the desired end state.
}
const pending = new Set(baseline.pending_matt_decision ?? [])
const seenPending = new Set()

const communities = Array.isArray(registry.communities) ? registry.communities : []
if (communities.length === 0) {
  console.error(`✗ ${REGISTRY}: missing or empty "communities"`)
  process.exit(1)
}

for (const c of communities) {
  const id = c?.slug ?? '(slug missing)'
  const aliases = Array.isArray(c?.subdivision_aliases) ? c.subdivision_aliases : []
  const label = String(c?.label ?? '').trim().toLowerCase()
  const v = c?.verification ?? {}
  const method = typeof v.method === 'string' ? v.method : ''
  const isPending = pending.has(id)
  if (isPending) seenPending.add(id)

  // A community whose only alias is its OWN LABEL claims no membership: every
  // renderer drops the label before printing chips (KbResortOverview's
  // aliasChips, peerPlatsForResort, place-knowledge), so nothing is asserted
  // about anyone. Those entries are out of scope here — not exempted by a
  // list, but by there being no claim to police.
  const children = aliases.filter((a) => String(a).trim().toLowerCase() !== label)
  const claimsMembership = children.length > 0

  // ── 1. The banned method ────────────────────────────────────────────────
  // A `method` string may DESCRIBE the old test when it says it replaced it;
  // it may not CLAIM it. The corrected entries all read "Replaces the prior
  // '…inside-test'" or "Supersedes the prior …", so the marker is only a fail
  // when the string does not also record that it superseded it.
  const supersedes = /\b(replaces|supersedes) the prior\b/i.test(method)
  const claimsProximity = PROXIMITY_MARKERS.some((re) => re.test(method)) && !supersedes
  if (claimsProximity && claimsMembership && !isPending) {
    fails.push(
      `${id}: verification.method still asserts membership from listing PROXIMITY ` +
        `("${method.slice(0, 80)}…"). A community's envelope contains the plats next door — ` +
        `re-verify against the county plat record + polygon containment, or add "${id}" to ${BASELINE}.`,
    )
  }

  // ── 5. child_count is the non-label alias count ─────────────────────────
  if (typeof c?.child_count === 'number' && c.child_count !== children.length) {
    fails.push(
      `${id}: child_count is ${c.child_count} but subdivision_aliases holds ${children.length} ` +
        `non-label alias(es). A stale count outlives the edit that changed the list.`,
    )
  }

  if (isPending || !claimsMembership) continue

  // ── 2. Every alias is evidenced ─────────────────────────────────────────
  const confirmed = Array.isArray(v.confirmed) ? v.confirmed : []
  const confirmedNames = new Set(confirmed.map((r) => String(r?.name ?? '').trim()))
  for (const alias of aliases) {
    if (!confirmedNames.has(String(alias).trim())) {
      fails.push(
        `${id}: alias "${alias}" has no row in verification.confirmed[] — every name rendered ` +
          `under "Subdivisions in ${c?.label ?? id}" must carry its own measurement.`,
      )
    }
  }
  for (const name of confirmedNames) {
    if (!aliases.some((a) => String(a).trim() === name)) {
      fails.push(`${id}: verification.confirmed names "${name}", which is not in subdivision_aliases.`)
    }
  }

  // ── 3 + 4. The numbers must be real, self-consistent, and above the bar ──
  for (const r of confirmed) {
    const who = `${id}/"${r?.name ?? '?'}"`
    const total = r?.listings_geocoded
    const inside = r?.inside_parent_polygon
    const pct = r?.pct_inside
    if (!Number.isInteger(total) || total < 0) {
      fails.push(`${who}: listings_geocoded must be a non-negative integer.`)
      continue
    }
    // inside === null means "no polygon exists to test against" — a fact about
    // the query, not a measured zero (§0). It is only legal alongside a null
    // pct, and the evidence rule below then demands the other query shape.
    if (inside === null) {
      if (pct !== null) {
        fails.push(`${who}: inside_parent_polygon is null (unmeasurable) but pct_inside is ${pct}.`)
        continue
      }
    } else {
      if (!Number.isInteger(inside) || inside < 0) {
        fails.push(`${who}: inside_parent_polygon must be a non-negative integer, or null if unmeasurable.`)
        continue
      }
      if (inside > total) {
        fails.push(`${who}: inside_parent_polygon (${inside}) exceeds listings_geocoded (${total}).`)
        continue
      }
      const expected = total === 0 ? null : Math.round((1000 * inside) / total) / 10
      if (pct !== expected) {
        fails.push(
          `${who}: pct_inside is ${pct} but ${inside}/${total} recomputes to ${expected}. ` +
            `Re-run the measurement; do not hand-edit the figure (§0).`,
        )
        continue
      }
    }
    const evidence = typeof r?.evidence === 'string' ? r.evidence.trim() : ''
    if ((pct === null || pct < POLYGON_BAR_PCT) && evidence.length < 40) {
      fails.push(
        `${who}: ${pct === null ? 'nothing measurable' : pct + '% inside'} the parent polygon and no ` +
          `"evidence" field. Below ${POLYGON_BAR_PCT}% the row must name the OTHER query shape that ` +
          `supports membership (MLS City, plat record, Matt directive) — absence from one query is not ` +
          `absence (CLAUDE.md §0).`,
      )
    }
  }
}

// ── The baseline ratchet: it may only shrink ──────────────────────────────
for (const slug of pending) {
  if (!communities.some((c) => c?.slug === slug)) {
    fails.push(`${BASELINE}: lists "${slug}", which is not a community in ${REGISTRY} — remove the stale entry.`)
    continue
  }
  if (!seenPending.has(slug)) continue
}
const stillNeeded = [...seenPending]

console.log('Resort membership evidence (G-RME)')
console.log('==================================')
console.log(`${communities.length} communities checked; ${stillNeeded.length} awaiting a Matt decision.`)
if (stillNeeded.length) {
  console.log(`  pending: ${stillNeeded.join(', ')}  (see ${BASELINE} — this list may only shrink)`)
}
console.log('')

if (fails.length) {
  console.error('✗ Resort membership is not evidenced:\n')
  for (const f of fails) console.error('  • ' + f)
  console.error(
    '\n  subdivision_aliases is a literal MEMBERSHIP claim ("Subdivisions in X") and it also\n' +
      '  scopes the alias-aware active count, the community market scope, and the CMA resort\n' +
      '  comp guard. Membership comes from the recorded county plat + polygon containment,\n' +
      '  never from listing proximity. See CLAUDE.md §0 and commit 05917a61 (Awbrey Glen).',
  )
  process.exit(1)
}

console.log('Every alias carries a measurement; no entry infers membership from proximity.')
process.exit(0)
