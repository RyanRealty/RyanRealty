#!/usr/bin/env node
/**
 * check-cma-send-floor.mjs — ci:cma-send-floor (G81).
 *
 * MATT'S 80% LINE (2026-09-30): an expired-listing CMA whose recommended list
 * price is under 80% of that listing's last list price never leaves the
 * building by any path; it goes to Matt. The rule lives in
 * lib/cma/send-floor.ts. On 2026-09-30 four CMAs went to owners at 72% to 79%
 * of their last list, each priced off the wrong sales, and nothing in the code
 * held them. This gate keeps every send path holding them.
 *
 * Rules (each one can fail on its own; scripts/__tests__/check-cma-send-floor.test.mjs):
 *   R1 the line     lib/cma/send-floor.ts exports EXPIRED_SEND_FLOOR_RATIO = 0.8.
 *   R2 the rail     sendCmaToLead (lib/cma/send.ts) checks the floor before the
 *                   solicitation screen and before delivering.
 *   R3 approve      approveCmaAction checks it before finalizing; unarchiveCmaAction
 *                   checks it before putting a page back (app/actions/cma-admin.ts).
 *   R4 prospecting  sendProspectingIntro and sendProspectingEmailIntro check it and
 *                   refuse with code 'price-floor' (app/actions/prospecting.ts).
 *   R5 legacy       finalizeAndDeliverCma (lib/cma-deliver.ts) checks it before sendEmail.
 *   R6 queue        resolveCmaQueueState returns 'held' on belowFloor, the CMA row
 *                   builder computes it (lib/data/cma/unified-queue.ts), and
 *                   approveAndDeliverCma refuses a held row (app/actions/cma-queue.ts).
 *   R7 drip         'price-floor' is a dequeue code (lib/data/prospecting/drip-drain.ts).
 *   R8 no bypass    any file under app/ or lib/ that sends mail or a text itself
 *                   (sendEmail, a Gmail send, sendSms*) with a /cma/ link acts on the floor.
 *   R9 no PDF       any file that renders a CMA PDF (renderCmaPdfBuffer) acts on the
 *                   floor, except the PDF module and the admin-only viewing route.
 *   R10 the page    serveCmaDocumentResult shows a held client-ready CMA to no
 *                   non-admin (lib/cma/serve-document.ts).
 *   R11 publish     publishCmaToListingAction acts on the floor (app/actions/cma-publish.ts).
 * "Acts on" means `const x = await getCmaSendFloorBySlug(...)` then `if (x.held`,
 * read with comments removed: a call whose answer is ignored is not a check.
 *
 * Usage: node scripts/check-cma-send-floor.mjs [--report]
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT = process.argv.includes('--report')
const FLOOR_CALL = 'getCmaSendFloorBySlug('
const failures = []

function fail(rule, msg) {
  failures.push(`${rule}: ${msg}`)
}

function read(rel) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) return null
  return readFileSync(p, 'utf8')
}

const printer = ts.createPrinter({ removeComments: true })

function sourceFile(rel) {
  const src = read(rel)
  if (src == null) return null
  return ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

/** The file's code with every comment removed, so a comment never satisfies or trips a rule. */
function code(rel) {
  const sf = sourceFile(rel)
  return sf ? printer.printFile(sf) : null
}

/** Code of `function name(...) {...}` (declaration, any export form), comments removed. */
function functionBody(rel, name) {
  const sf = sourceFile(rel)
  if (!sf) return null
  let body = null
  const visit = (node) => {
    if (body) return
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && node.body) {
      body = printer.printNode(ts.EmitHint.Unspecified, node.body, sf)
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return body
}

/**
 * Where `text` reads the floor and then acts on it: `const x = await
 * getCmaSendFloorBySlug(...)` followed by `if (x.held`. Returns the index of
 * that `if`, or a reason it is missing. Calling the check and ignoring its
 * answer is not a check.
 */
function floorUse(text) {
  const m = /const\s+(\w+)\s*=\s*await\s+getCmaSendFloorBySlug\(/.exec(text)
  if (!m) return { at: -1, why: 'does not read the floor (const x = await getCmaSendFloorBySlug(...))' }
  const use = new RegExp(`if\\s*\\(\\s*${m[1]}\\.held\\b`).exec(text.slice(m.index))
  if (!use) return { at: -1, why: `reads the floor into ${m[1]} but never acts on ${m[1]}.held` }
  return { at: m.index + use.index, why: null }
}

/** The function acts on the floor, and before every `later` marker that occurs in it. */
function callsBefore(rule, rel, fn, laterMarkers = []) {
  const body = functionBody(rel, fn)
  if (body == null) {
    fail(rule, `${rel}: function ${fn} not found`)
    return
  }
  const use = floorUse(body)
  if (use.at < 0) {
    fail(rule, `${rel}: ${fn} ${use.why}`)
    return
  }
  for (const later of laterMarkers) {
    const l = body.indexOf(later)
    if (l >= 0 && l < use.at) fail(rule, `${rel}: ${fn} reaches ${later.replace('(', '')} before acting on the 80% check`)
  }
}

// R1 — the line itself.
{
  const src = read('lib/cma/send-floor.ts')
  if (src == null) fail('R1', 'lib/cma/send-floor.ts is missing')
  else if (!/export const EXPIRED_SEND_FLOOR_RATIO\s*=\s*0\.8\s*(\n|;)/.test(src))
    fail('R1', 'lib/cma/send-floor.ts must export EXPIRED_SEND_FLOOR_RATIO = 0.8 (Matt 2026-09-30); moving the line is his call')
}

// R2 — the canonical rail.
callsBefore('R2', 'lib/cma/send.ts', 'sendCmaToLead', ['screenAddressForSolicitation(', 'deliverCmaToLead('])

// R3 — approve and unarchive.
callsBefore('R3', 'app/actions/cma-admin.ts', 'approveCmaAction', ['updateCmaRowFieldsBySlug('])
callsBefore('R3', 'app/actions/cma-admin.ts', 'unarchiveCmaAction', ['updateCmaRowFieldsBySlug('])

// R4 — the prospecting text and email intros.
for (const fn of ['sendProspectingIntro', 'sendProspectingEmailIntro']) {
  callsBefore('R4', 'app/actions/prospecting.ts', fn, ['sendCmaToLead(', 'claimProspectSend(', 'claimProspectEmailSend('])
  const body = functionBody('app/actions/prospecting.ts', fn)
  if (body != null && !/'price-floor'/.test(body))
    fail('R4', `app/actions/prospecting.ts: ${fn} must refuse a held CMA with code 'price-floor'`)
}

// R5 — the legacy finalize-and-deliver path.
callsBefore('R5', 'lib/cma-deliver.ts', 'finalizeAndDeliverCma', ['sendEmail('])

// R6 — the queue.
{
  const resolveBody = functionBody('lib/data/cma/unified-queue.ts', 'resolveCmaQueueState')
  if (resolveBody == null) fail('R6', 'lib/data/cma/unified-queue.ts: resolveCmaQueueState not found')
  else if (!/belowFloor[\s\S]{0,120}return 'held'/.test(resolveBody))
    fail('R6', "lib/data/cma/unified-queue.ts: resolveCmaQueueState must return 'held' when belowFloor")
  const q = code('lib/data/cma/unified-queue.ts') ?? ''
  if (!q.includes('expiredSendFloor(') || !/belowFloor:\s*floor\.held/.test(q))
    fail('R6', 'lib/data/cma/unified-queue.ts: the CMA row builder must compute expiredSendFloor and pass belowFloor: floor.held')
  const send = functionBody('app/actions/cma-queue.ts', 'approveAndDeliverCma')
  if (send == null) fail('R6', 'app/actions/cma-queue.ts: approveAndDeliverCma not found')
  else if (!send.includes("row.state === 'held'"))
    fail('R6', "app/actions/cma-queue.ts: approveAndDeliverCma must refuse a row in state 'held'")
}

// R7 — the drip leaves a held row instead of retrying it.
{
  const src = code('lib/data/prospecting/drip-drain.ts') ?? ''
  const m = /const DEQUEUE_CODES[^=]*=\s*new Set[^(]*\(\[([\s\S]*?)\]\)/.exec(src)
  if (!m || !m[1].includes("'price-floor'"))
    fail('R7', "lib/data/prospecting/drip-drain.ts: DEQUEUE_CODES must include 'price-floor'")
}

// R10 — the public page: a held client-ready CMA is not shown to a non-admin.
{
  const body = functionBody('lib/cma/serve-document.ts', 'serveCmaDocumentResult')
  if (body == null) fail('R10', 'lib/cma/serve-document.ts: serveCmaDocumentResult not found')
  else {
    const use = floorUse(body)
    if (use.at < 0) fail('R10', `lib/cma/serve-document.ts: serveCmaDocumentResult ${use.why}`)
    else if (!/CMA_BEING_UPDATED_HTML/.test(body.slice(use.at, use.at + 400)))
      fail('R10', 'lib/cma/serve-document.ts: a held CMA must get the being-updated page')
  }
}

// R11 — a listing page hands the document to any registrant.
callsBefore('R11', 'app/actions/cma-publish.ts', 'publishCmaToListingAction', ['updateCmaRowFieldsBySlug('])

// R8 / R9 — nothing else mails, texts or attaches a CMA without acting on the floor.
{
  const SENDS = /\bsendEmail\s*\(|gmail\.users\.messages\.send\s*\(|\bsendGmailMessage\s*\(|\bsendSmsViaMessagingService\s*\(|\bsendSms\s*\(/
  const CMA_LINK = /\/cma\/(\$\{|["'`]\s*\+)/
  const PDF = /\brenderCmaPdfBuffer\s*\(/
  // The PDF's own module and the admin-only viewing route (admin session or
  // cron secret; it shows the document to a broker, it sends nothing).
  const PDF_EXEMPT = new Set(['lib/cma-pdf.ts', 'app/api/cma/[slug]/pdf/route.ts'])
  const walk = (dir) => {
    const abs = join(ROOT, dir)
    if (!existsSync(abs)) return []
    const out = []
    for (const name of readdirSync(abs)) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      const rel = join(dir, name)
      const st = statSync(join(ROOT, rel))
      if (st.isDirectory()) out.push(...walk(rel))
      else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(rel)
    }
    return out
  }
  for (const rel of [...walk('app'), ...walk('lib')]) {
    const raw = read(rel) ?? ''
    // Cheap pre-filter on the raw text; the rule itself reads comment-free code.
    if (!/sendEmail|gmail|sendSms|renderCmaPdfBuffer/.test(raw)) continue
    const src = code(rel) ?? ''
    const acts = floorUse(src).at >= 0
    const path = relative(ROOT, join(ROOT, rel))
    if (SENDS.test(src) && CMA_LINK.test(src) && !acts)
      fail('R8', `${path} sends mail or a text with a /cma/ link and does not act on getCmaSendFloorBySlug`)
    if (PDF.test(src) && !PDF_EXEMPT.has(path) && !acts)
      fail('R9', `${path} renders a CMA PDF for someone and does not act on getCmaSendFloorBySlug`)
  }
}

if (REPORT) {
  console.log(failures.length ? failures.join('\n') : 'ci:cma-send-floor: every send path holds the 80% line.')
  process.exit(0)
}
if (failures.length) {
  console.error(`ci:cma-send-floor FAILED (${failures.length})\n  ${failures.join('\n  ')}`)
  console.error('\nAn expired CMA under 80% of its last list never sends (Matt 2026-09-30). See lib/cma/send-floor.ts.')
  process.exit(1)
}
console.log('ci:cma-send-floor — OK: every send path holds the 80% line.')
