#!/usr/bin/env node
/**
 * check-broker-published-phone.mjs — ci:broker-published-phone.
 *
 * public.brokers carries THREE phone columns that mean different things:
 *
 *   twilio_number    the business line. The main business number routes a lead
 *                    to it, and it forwards to the broker's cell. PUBLISHABLE.
 *   forward_to_cell  the broker's personal mobile. NEVER publishable.
 *   phone            a legacy column that, for two of the three brokers, holds
 *                    the SAME value as forward_to_cell. Verified 2026-07-24:
 *                      paul-stevenson    phone 541-977-6841  = forward_to_cell
 *                      rebecca-peterson  phone (415) 308-9087 = forward_to_cell
 *                      matthew-ryan      phone (541) 703-3095 = twilio_number
 *                    So `phone` is right for one broker by luck and wrong for
 *                    the other two.
 *
 * This is not hypothetical. lib/cma/build.ts and lib/bpo/build.ts both mapped
 * `phone: row.phone` into the document's signature block, which
 * lib/cma/render.ts prints in four places. Every CMA to date happens to be
 * Matt's, so nothing has leaked — but W10.3 exists to re-brand a document to
 * another broker, and the first Paul or Rebecca CMA would have printed their
 * personal cell on a client-facing pricing document.
 *
 * A comment cannot hold that. One plausible line ("use the broker's phone")
 * reintroduces it, so it is mechanical.
 *
 * ASSERTS:
 *   1. No client-facing document builder reads `.phone` off a brokers row.
 *      (lib/cma/build.ts, lib/bpo/build.ts — AST, so a rename does not evade.)
 *   2. The brokers DAL that feeds those documents selects twilio_number and
 *      does NOT select the bare `phone` column.
 *   3. `forward_to_cell` appears in no rendering, email, or document path at
 *      all. It is routing configuration, never content.
 *
 * Exit: 0 = no publish path can reach a personal cell. 1 = otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const DOC_BUILDERS = ['lib/cma/build.ts', 'lib/bpo/build.ts']
const DOC_BROKER_DAL = 'lib/data/cma/builderReads.ts'
/** Paths that render or transmit content. forward_to_cell must not appear here. */
const CONTENT_GLOBS = ['lib/cma', 'lib/bpo', 'lib/email', 'components', 'app']

const problems = []

// ── 1. document builders must not read a brokers row's `phone` ───────────────
for (const rel of DOC_BUILDERS) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    problems.push(`${rel}: not found — a document builder was moved; re-point this gate.`)
    continue
  }
  const sf = ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const walk = (node) => {
    // row.phone / broker.phone / data.phone — any property access named `phone`
    // whose object is a plain identifier (the shape a DB row is held in here).
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'phone' && ts.isIdentifier(node.expression)) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
      problems.push(
        `${rel}:${line}: reads \`${node.expression.text}.phone\`. For paul-stevenson and rebecca-peterson that column holds their PERSONAL CELL (same value as forward_to_cell). Publish \`twilio_number\` instead — it is the line the main business number routes to, and it forwards to their cell.`,
      )
    }
    // element access: row['phone']
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === 'phone'
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
      problems.push(`${rel}:${line}: reads a brokers row's ['phone'] — publish twilio_number instead.`)
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
}

// ── 2. the document broker DAL selects twilio_number, not phone ──────────────
{
  const p = join(process.cwd(), DOC_BROKER_DAL)
  if (!existsSync(p)) {
    problems.push(`${DOC_BROKER_DAL}: not found — re-point this gate.`)
  } else {
    const sf = ts.createSourceFile(
      DOC_BROKER_DAL,
      readFileSync(p, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )
    /** Every string literal that looks like a brokers column list. */
    const selects = []
    const walk = (node) => {
      if (ts.isStringLiteralLike(node) && /\bslug\b/.test(node.text) && /\bdisplay_name\b/.test(node.text)) {
        selects.push({ text: node.text, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 })
      }
      ts.forEachChild(node, walk)
    }
    walk(sf)

    if (!selects.length) {
      problems.push(`${DOC_BROKER_DAL}: no brokers column list found — this gate can no longer see what is selected.`)
    }
    for (const sel of selects) {
      const cols = sel.text.split(',').map((c) => c.trim())
      if (cols.includes('phone')) {
        problems.push(
          `${DOC_BROKER_DAL}:${sel.line}: selects the bare \`phone\` column for a client-facing document. Select \`twilio_number\`.`,
        )
      }
      if (cols.includes('forward_to_cell')) {
        problems.push(`${DOC_BROKER_DAL}:${sel.line}: selects \`forward_to_cell\` — that is a personal mobile.`)
      }
      if (!cols.includes('twilio_number')) {
        problems.push(
          `${DOC_BROKER_DAL}:${sel.line}: does not select \`twilio_number\`, so the signature block has no publishable number to render.`,
        )
      }
    }
  }
}

// ── 3. forward_to_cell must not appear in any content path ───────────────────
{
  let hits = ''
  try {
    hits = execFileSync(
      'grep',
      ['-rn', '--include=*.ts', '--include=*.tsx', 'forward_to_cell', ...CONTENT_GLOBS],
      { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
  } catch {
    hits = '' // grep exits 1 when nothing matches — that is the good case
  }
  for (const line of hits.split('\n').filter(Boolean)) {
    // Routing/admin config may legitimately name the column; content may not.
    if (/\/(api|actions|admin)\//.test(line) || /crm/i.test(line)) continue
    // A COMMENT explaining why the column must not be rendered is not a render.
    // (This gate's whole purpose is to make that reasoning safe to write down.)
    const code = line.replace(/^[^:]*:\d+:/, '').trim()
    if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) continue
    problems.push(
      `${line.split(':').slice(0, 2).join(':')}: references \`forward_to_cell\` in a content path. That column is a personal mobile — routing configuration only, never rendered.`,
    )
  }
}

console.log('Broker published-phone gate (ci:broker-published-phone)')
console.log('======================================================')
if (problems.length) {
  for (const pr of problems) console.error(`  ✗ ${pr}`)
  console.error(`\n\x1b[31m✗ ci:broker-published-phone: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Client-facing documents publish twilio_number; no path reaches a personal cell.')
process.exit(0)
