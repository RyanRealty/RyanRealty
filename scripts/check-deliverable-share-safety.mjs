#!/usr/bin/env node
/**
 * check-deliverable-share-safety.mjs — ci:deliverable-share-safety (W10.6).
 *
 * The broker content library holds 361 content:cma rows — each a CLIENT'S
 * CONFIDENTIAL valuation — plus internal comms/analyze/ops/site rows. The
 * interim share-to-social affordance must NEVER offer any of those for a public
 * feed. Sharing a CMA to Instagram would expose a client's pricing.
 *
 * This is a security property, so it is EXECUTED, not grepped:
 *
 *   A. Bundle lib/marketing-brain/deliverable-share.ts and RUN isShareableToSocial
 *      against a fixture table. Every private type (content:cma, content:bpo,
 *      comms:*, analyze:*, ops:*, site:*) must be false; the public content types
 *      must be true; an unknown type must be false (default-deny). captionFor
 *      must return '' for every private type.
 *   B. AST-assert the content-library page renders DeliverableShareBar ONLY
 *      behind an isShareableToSocial gate — never unconditionally.
 *
 * Exit: 0 = no private deliverable can be shared to social. 1 = otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { loadShareModule } from './lib/deliverable-share-runtime.mjs'

const MODULE = 'lib/marketing-brain/deliverable-share.ts'
const PAGE = 'app/admin/(protected)/content-library/page.tsx'
const problems = []

// ── A. behavior: run the allowlist against a fixture table ───────────────────
async function checkBehavior() {
  const loaded = await loadShareModule(process.cwd())
  if (!loaded.ok) {
    problems.push(`${MODULE}: could not be executed for the safety check — ${loaded.error}`)
    return
  }
  const { isShareableToSocial, captionFor, SHAREABLE_TYPE_KEYS } = loaded.mod
  if (typeof isShareableToSocial !== 'function' || typeof captionFor !== 'function') {
    problems.push(`${MODULE}: must export isShareableToSocial and captionFor.`)
    return
  }

  // THE INVARIANT (inverted from a known-private enumeration — round W10.6-verify).
  // Enumerating private types can never be complete: a NEW private deliverable
  // (content:seller_net_sheet — a confidential client financial doc named in
  // CLAUDE.md) added to the allowlist leaked past the old gate. So instead pin
  // the allowlist to a FROZEN known-public set defined HERE, in the gate. Any
  // key added to the module's allowlist now fails CI until a reviewer also edits
  // this set — a deliberate, reviewed act, not a reflexive one-liner. This set
  // must contain ONLY types that are safe to broadcast to a public feed; never
  // add a client document (cma/bpo/net_sheet), a lead-gen ad, or internal comms.
  const FROZEN_PUBLIC_KEYS = new Set([
    'content-blog-post',
    'content-market-report-blog',
    'content-market-data-short',
    'content-ig-carousel',
    'content-linkedin-doc-carousel',
    'content-listing-reel',
    'content-listing-image',
    'content-just-listed-flyer',
    'content-news-clip',
    'content-sold-deal-summary',
    'content-newsletter',
    'content-gbp-post',
    'content-list-kit',
  ])
  if (!Array.isArray(SHAREABLE_TYPE_KEYS)) {
    problems.push(`${MODULE}: does not export SHAREABLE_TYPE_KEYS as an array — the gate cannot pin the allowlist.`)
  } else {
    for (const key of SHAREABLE_TYPE_KEYS) {
      if (!FROZEN_PUBLIC_KEYS.has(key)) {
        problems.push(
          `${MODULE}: SHAREABLE_TYPE_KEYS contains '${key}', which is NOT in the gate's frozen known-public set. If this is genuinely public content, add it to FROZEN_PUBLIC_KEYS in ${'scripts/check-deliverable-share-safety.mjs'} in the same change — that two-place edit is the review checkpoint that keeps a client document off a public feed.`,
        )
      }
    }
  }

  // MUST be false — private client docs and internal content, in both the
  // action-type (colon) and the archived filename (dash + .json) spellings.
  const PRIVATE = [
    'content:cma', 'content-cma.json', 'content:bpo', 'content-bpo.json',
    'comms:matt_summary', 'comms-matt-summary.json', 'comms:matt_alert',
    'analyze:audit_findings', 'analyze-competitor-report.json',
    'ops:meta_budget', 'ops-gbp-post.json', 'site:cta_update', 'site-cta-update.json',
    'content:test', '', 'content:something_new_and_unknown', 'totally-made-up.json',
  ]
  for (const t of PRIVATE) {
    if (isShareableToSocial(t)) {
      problems.push(`${MODULE}: isShareableToSocial(${JSON.stringify(t)}) is TRUE. A private/unknown deliverable must never be shareable to a public feed.`)
    }
    if (captionFor(t) !== '') {
      problems.push(`${MODULE}: captionFor(${JSON.stringify(t)}) returned a non-empty caption for a non-shareable type.`)
    }
  }

  // MUST be true — public content a broker legitimately shares.
  const PUBLIC = [
    'content:blog_post', 'content-blog-post.json', 'content:market_report_blog',
    'content:ig_carousel', 'content-ig-carousel.json', 'content:listing_reel',
    'content:news_clip', 'content:sold_deal_summary', 'content:gbp_post',
  ]
  for (const t of PUBLIC) {
    if (!isShareableToSocial(t)) {
      problems.push(`${MODULE}: isShareableToSocial(${JSON.stringify(t)}) is FALSE — a public content type is not shareable, so the feature does nothing.`)
    }
  }

  // captions carry NO digits (CLAUDE.md section 0 — no fabricated numbers).
  for (const t of PUBLIC) {
    const cap = captionFor(t)
    if (/\d/.test(cap)) {
      problems.push(`${MODULE}: captionFor(${JSON.stringify(t)}) contains a digit. Share captions must be qualitative — a broker adds specifics, so no number can be fabricated.`)
    }
    if (/[—–;]/.test(cap)) {
      problems.push(`${MODULE}: captionFor(${JSON.stringify(t)}) contains an em-dash/en-dash/semicolon (brand voice).`)
    }
  }
}

// ── B. the surface renders the bar only behind the gate ──────────────────────
function checkSurface() {
  const p = join(process.cwd(), PAGE)
  if (!existsSync(p)) {
    problems.push(`${PAGE}: not found — re-point this gate.`)
    return
  }
  const sf = ts.createSourceFile(PAGE, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  // Find every JSX use of DeliverableShareBar and confirm each sits inside a
  // conditional whose test references `shareable` (row.shareable) — never
  // rendered unconditionally.
  let uses = 0
  let unguarded = 0
  const isShareBarTag = (node) => {
    const tag = ts.isJsxElement(node)
      ? node.openingElement.tagName
      : ts.isJsxSelfClosingElement(node)
        ? node.tagName
        : null
    return tag ? tag.getText() === 'DeliverableShareBar' : false
  }
  const guardedByShareable = (node) => {
    let cur = node.parent
    while (cur) {
      // {row.shareable && <DeliverableShareBar .../>} or a ternary on shareable
      if (
        (ts.isBinaryExpression(cur) && cur.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) ||
        ts.isConditionalExpression(cur) ||
        ts.isIfStatement(cur)
      ) {
        const cond = ts.isBinaryExpression(cur) ? cur.left
          : ts.isConditionalExpression(cur) ? cur.condition
            : cur.expression
        if (/\bshareable\b/.test(cond.getText())) return true
      }
      cur = cur.parent
    }
    return false
  }
  const walk = (node) => {
    if (isShareBarTag(node)) {
      uses++
      if (!guardedByShareable(node)) unguarded++
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)

  if (uses === 0) {
    problems.push(`${PAGE}: never renders DeliverableShareBar — the share affordance is missing.`)
  }
  if (unguarded > 0) {
    problems.push(`${PAGE}: renders DeliverableShareBar without a \`shareable\` guard (${unguarded} site(s)). A CMA or internal summary could then show a share affordance.`)
  }
}

await checkBehavior()
checkSurface()

console.log('Deliverable share-to-social safety gate (ci:deliverable-share-safety)')
console.log('====================================================================')
if (problems.length) {
  for (const pr of problems) console.error(`  ✗ ${pr}`)
  console.error(`\n\x1b[31m✗ ci:deliverable-share-safety: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Only public content types are shareable (executed); the surface gates every share bar.')
process.exit(0)
