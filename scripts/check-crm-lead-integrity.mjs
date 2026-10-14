/**
 * G49 — CRM lead-integrity gate.
 *
 * Locks lead-ingestion invariants for the in-house CRM:
 *
 *   - inbound leads go through sendEvent → ensureNativeLead (crm_people), never
 *     a third-party people POST
 *   - SMS must go through the approved sender + consent gate, not a log-only
 *     third-party textMessages POST
 *   - source is required on every event so marketing attribution survives
 *   - lead-type events tag audience:buyer or audience:seller
 *   - every write of crm_people.source names the DOOR, never the host, and the
 *     reuse path keeps source first-touch (FUNNEL-4, 2026-09-23)
 *   - the public intake screen (quality:suspect) is wired from the contact-form
 *     honeypot through sendEvent/ensureNativeLead to every machine that acts on
 *     a new lead: enroll, broker alerts, tasks, response clock, hot-lead
 *     escalation (FUNNEL-1, 2026-09-23)
 *
 * Usage: node scripts/check-crm-lead-integrity.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = process.cwd()
const BT = String.fromCharCode(96)

const KNOWN_PEOPLE_POST = new Set([
  'app/api/meta/lead-webhook/route.ts',
])

const AUDIENCE_TAG_ALLOW = new Set([
  'app/actions/home.ts', // subscribeNewsletter — audience unknown at signup
])

const textCache = new Map()
/** A repo file's text, read once per run; null when it does not exist. */
export function readRepoFile(rel) {
  if (!textCache.has(rel)) {
    const abs = join(ROOT, rel)
    textCache.set(rel, existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : null)
  }
  return textCache.get(rel)
}

const SCAN = ['lib', 'app']
function walk(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === '.next') continue
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}

/** Every non-test .ts/.tsx file under app/ and lib/, the files this gate reads. */
export function scannedFiles() {
  return SCAN.flatMap((d) => walk(d))
}

// ── FUNNEL-4: crm_people.source is the door ─────────────────────────────────

/**
 * The calls that write crm_people.source: sendEvent, and ensureNativeLead (the
 * native write under it, which some doors also call directly as a fallback).
 */
const SOURCE_WRITERS = new Set(['sendEvent', 'ensureNativeLead'])

/** Text that names the site's host or origin. lib/site-origin.ts is the one place the host comes from (2026-10-07). */
const HOST_TEXT = /NEXT_PUBLIC_SITE_URL|ryan-realty\.com|https?:\/\/|\bsite(?:Host|Origin|Url)\b|\bwebsiteSource\b/

/**
 * Writes whose source is not a door label this gate can read, each scoped to
 * its file and to its source expression as written, with the reason. Kind
 * 'host': the write may carry the site host. Kind 'opaque': the value is not
 * readable here, and the reason says why it still names a door. An entry that
 * matches no write needing it fails, so the list only describes code that exists.
 */
export const SOURCE_ALLOWED = {
  'lib/crm/send-event.ts': {
    'params.source': { kind: 'opaque', reason: "The spine: it writes its caller's source, and every caller is read here." },
  },
  'app/actions/track-cta-click.ts': {
    // reuseSourcePatch reads the host as no door, so the person's first real
    // door still fills an empty source; a made-up label here would block it.
    source: { kind: 'host', reason: 'A CTA click by a person already known (Visited Website), not a door.' },
  },
  'app/api/cron/crm-portal-lead-intake/route.ts': {
    portal: { kind: 'opaque', reason: 'The portal the lead email came from (Portal in lib/crm/portal-lead-parser.ts).' },
  },
  'app/lp/seller-home-value/actions.ts': {
    'resolveLeadSource(originUtmSource, lpSource)': {
      kind: 'opaque',
      reason: "The ad platform of a paid visit, else the form's LP door (resolveLeadSource in lib/crm/lead-source.ts).",
    },
  },
}

function resolveModule(spec, fromRel, read) {
  let base
  if (spec.startsWith('@/')) base = spec.slice(2)
  else if (spec.startsWith('.')) base = posix.join(posix.dirname(fromRel), spec)
  else return null
  for (const rel of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.(ts|tsx)$/.test(rel) && read(rel) != null) return rel
  }
  return null
}

function propertyName(p) {
  return p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null
}

/** Does a binding name (an identifier or a destructuring pattern) bind `text`? */
function bindsName(name, text) {
  if (ts.isIdentifier(name)) return name.text === text
  return name.elements.some((el) => !ts.isOmittedExpression(el) && bindsName(el.name, text))
}

function calleeName(expr) {
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text
  return null
}

/**
 * Parses files on demand (one parse per file) and reads each write's source on
 * the syntax tree, so a comment, a nested campaign.source or a `message: source`
 * value is never taken for the key.
 */
function sourceProject(read) {
  const modules = new Map()

  function load(rel) {
    if (modules.has(rel)) return modules.get(rel)
    const text = read(rel)
    let mod = null
    if (text != null) {
      const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      mod = { rel, sf, values: new Map(), imports: new Map(), writes: [] }
      const assign = (name, node) => mod.values.set(name, [...(mod.values.get(name) ?? []), node])
      const visit = (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) assign(node.name.text, node.initializer)
        else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) assign(node.left.text, node.right)
        else if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const bindings = node.importClause?.namedBindings
          if (bindings && ts.isNamedImports(bindings)) {
            for (const el of bindings.elements) mod.imports.set(el.name.text, { from: node.moduleSpecifier.text, name: (el.propertyName ?? el.name).text })
          }
        } else if (ts.isCallExpression(node) && SOURCE_WRITERS.has(calleeName(node.expression))) {
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
          const write = { callee: calleeName(node.expression), line, expr: null, node: null }
          const arg = node.arguments[0]
          if (arg && ts.isObjectLiteralExpression(arg)) {
            const prop = arg.properties.find(
              (p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && propertyName(p) === 'source',
            )
            if (prop) write.node = ts.isShorthandPropertyAssignment(prop) ? prop.name : prop.initializer
            else if (arg.properties.some((p) => ts.isSpreadAssignment(p))) write.expr = arg.getText(sf)
          } else if (arg) {
            write.expr = arg.getText(sf)
          }
          if (write.node) write.expr = write.node.getText(sf)
          if (write.expr !== null) mod.writes.push(write)
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
    modules.set(rel, mod)
    return mod
  }

  const hasHost = (leaves) => leaves.some((l) => l.kind === 'host')

  /**
   * What an identifier can hold: opaque when a parameter of an enclosing function
   * binds it (whatever the caller passes), else what the file assigns it, else
   * the const it imports, else opaque.
   */
  function nameLeaves(id, mod, seen) {
    const name = id.text
    if (name === 'undefined') return []
    for (let n = id.parent; n; n = n.parent) {
      if (ts.isFunctionLike(n) && n.parameters?.some((p) => bindsName(p.name, name))) return [{ kind: 'opaque', text: name }]
    }
    const local = mod.values.get(name)
    if (local) return local.flatMap((n) => leaves(n, mod, seen))
    const imp = mod.imports.get(name)
    const target = imp && resolveModule(imp.from, mod.rel, read)
    const other = target && load(target)
    const exported = other?.values.get(imp.name)
    if (exported) return exported.flatMap((n) => leaves(n, other, seen))
    return [{ kind: 'opaque', text: name }]
  }

  /**
   * What a source expression can evaluate to: 'label' (a door name), 'host' (the
   * site's host or origin) or 'opaque' (a parameter, a call, a property).
   */
  function leaves(node, mod, seen = new Set()) {
    if (seen.has(node)) return []
    seen.add(node)
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node)) {
      return leaves(node.expression, mod, seen)
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return [{ kind: HOST_TEXT.test(node.text) ? 'host' : 'label', text: node.text }]
    }
    if (ts.isConditionalExpression(node)) return [...leaves(node.whenTrue, mod, seen), ...leaves(node.whenFalse, mod, seen)]
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.BarBarToken || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
      return [...leaves(node.left, mod, seen), ...leaves(node.right, mod, seen)]
    }
    if (ts.isIdentifier(node)) return nameLeaves(node, mod, seen)
    const text = node.getText(mod.sf)
    if (ts.isTemplateExpression(node)) {
      // A fixed lead-in names the door (`Facebook Lead Ad — ${campaign}`).
      if (HOST_TEXT.test(node.head.text) || node.templateSpans.some((s) => hasHost(leaves(s.expression, mod, seen)))) return [{ kind: 'host', text }]
      return [{ kind: node.head.text.trim() ? 'label' : 'opaque', text }]
    }
    let host = HOST_TEXT.test(text)
    if (!host && (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node))) {
      // `base.replace(…)`, `new URL(origin).host`, `pick(utm, siteHost())`: the host passed through.
      const receiver = ts.isCallExpression(node) ? node.expression : node
      if (ts.isPropertyAccessExpression(receiver)) host = hasHost(leaves(receiver.expression, mod, seen))
      if (!host && ts.isCallExpression(node)) host = node.arguments.some((a) => hasHost(leaves(a, mod, seen)))
    }
    return [{ kind: host ? 'host' : 'opaque', text }]
  }

  /** Each crm_people.source write in a file, with what its source can hold. */
  function writes(rel) {
    const mod = load(rel)
    if (!mod) return []
    return mod.writes.map((w) => ({
      callee: w.callee,
      line: w.line,
      expr: w.expr.replace(/\s+/g, ' '),
      leaves: w.node ? leaves(w.node, mod) : [{ kind: 'opaque', text: w.expr }],
    }))
  }

  return { writes }
}

/** Each sendEvent / ensureNativeLead in one file, with the source expression and what it can hold. */
export function sourceWrites(rel, read = readRepoFile) {
  return sourceProject(read).writes(rel)
}

/**
 * The FUNNEL-4 failures across `files`: a write whose source is the site host or
 * cannot be read down to a door label, unless `allowed` names that file and
 * expression with the matching kind; and an allowance no write needs.
 */
export function sourceWriteFailures(files, { read = readRepoFile, allowed = SOURCE_ALLOWED } = {}) {
  const project = sourceProject(read)
  const fails = []
  const used = new Set()
  const scanned = new Set(files)
  for (const rel of files) {
    const text = read(rel)
    if (text == null || !/\b(?:sendEvent|ensureNativeLead)\s*\(/.test(text)) continue
    for (const w of project.writes(rel)) {
      const need = w.leaves.some((l) => l.kind === 'host') ? 'host' : w.leaves.some((l) => l.kind === 'opaque') ? 'opaque' : null
      if (need === null) continue
      const allowance = allowed[rel]?.[w.expr]
      if (allowance?.kind === need) {
        used.add(`${rel}\n${w.expr}`)
        continue
      }
      if (need === 'host') {
        fails.push(
          `${rel}:${w.line}: ${w.callee} source \`${w.expr}\` is the site host. Write the door label ('contact-form', 'idx-registration', 'seller-lp', 'buyer-lp', 'place-page', 'published-cma', ...) so crm_people.source says which form it was (FUNNEL-4), or allow it in SOURCE_ALLOWED with the reason it is not a door.`,
        )
      } else {
        const unread = w.leaves.filter((l) => l.kind === 'opaque').map((l) => l.text.replace(/\s+/g, ' '))
        fails.push(
          `${rel}:${w.line}: ${w.callee} source \`${w.expr}\` does not read down to a door label (${unread.join(', ')}). Name the door with a string or a const, or allow it in SOURCE_ALLOWED with the reason it names a door (FUNNEL-4).`,
        )
      }
    }
  }
  for (const [rel, entries] of Object.entries(allowed)) {
    for (const [expr, { kind }] of Object.entries(entries)) {
      if (!used.has(`${rel}\n${expr}`)) {
        fails.push(
          `${rel}: SOURCE_ALLOWED allows \`${expr}\` (${kind}), but ${scanned.has(rel) ? `no write there needs a ${kind} allowance` : 'the file is not scanned'}. Remove the entry.`,
        )
      }
    }
  }
  return fails
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = scannedFiles()
  const fails = []

  for (const rel of files) {
    const src = readRepoFile(rel)
    const postsToBarePeople = src.includes('/people' + BT) && /method:\s*['"]POST['"]/.test(src)
    if (postsToBarePeople && !KNOWN_PEOPLE_POST.has(rel)) {
      fails.push(
        `${rel}: POSTs to a bare /people endpoint to create a lead. Inbound leads MUST go through sendEvent from '@/lib/crm/send-event' so dedup and enrollment run.`,
      )
    }
    const postsTextMessages = src.includes('/textMessages' + BT) && /method:\s*['"]POST['"]/.test(src)
    if (postsTextMessages) {
      fails.push(
        `${rel}: POSTs to /textMessages. That is a log-only third-party path, not a send. Route real SMS through the approved sender + consent gate.`,
      )
    }

    const isClientDef = rel === 'lib/crm/send-event.ts'
    const createsLead = /\bsendEvent\s*\(/.test(src)
    const firesLeadEvent = /['"](Registration|Seller Inquiry|Buyer Inquiry|Open House RSVP)['"]/.test(src)
    const tagsAudience = /canonicallyTagLead|['"]audience:/.test(src)
    if (createsLead && firesLeadEvent && !isClientDef && !tagsAudience && !AUDIENCE_TAG_ALLOW.has(rel)) {
      fails.push(
        `${rel}: creates a lead (sendEvent with a lead-type event) but never tags the audience. Route the person through canonicallyTagLead from '@/lib/canonical-lead-tagger', or apply an audience:* tag. Allowlist in AUDIENCE_TAG_ALLOW only if it is genuinely a non-lead activity event.`,
      )
    }
  }

  const sendEventSrc = readRepoFile('lib/crm/send-event.ts') ?? ''
  if (!sendEventSrc) {
    fails.push('lib/crm/send-event.ts missing — native lead capture is the CRM spine.')
  } else if (!/\bsource:\s*string\b/.test(sendEventSrc)) {
    fails.push(
      'lib/crm/send-event.ts: SendEventParams must keep `source: string` (required, not optional) so every lead event carries marketing attribution.',
    )
  }

  // ── FUNNEL-4 (visibility audit 2026-09-22): source is the DOOR, and it is first-touch ──
  // Every site door stamped crm_people.source with the site host ('ryan-realty.com',
  // 76 of 88 site leads in 30 days), so no report could tell a contact-form note from
  // an alerts signup, and the reuse path overwrote the column with the latest door.
  //
  // Every sendEvent and ensureNativeLead in app/ and lib/, read on the syntax tree.
  // Until 2026-10-14 the check named four door files and matched text, so nine more
  // doors still wrote the host: the CMA download and pricing read, the signed-in
  // saved search, the listing payment email, the /buy lead form, the page CTA, the
  // rental calculator, the Tetherow endpoint and the CMA PDF route.
  fails.push(...sourceWriteFailures(files))

  const ensureSrc = readRepoFile('lib/data/crm/ensureNativeLead.ts') ?? ''
  if (/update\.source\s*=\s*input\.source/.test(ensureSrc) || !/reuseSourcePatch\(/.test(ensureSrc)) {
    fails.push(
      'lib/data/crm/ensureNativeLead.ts: the REUSE path must keep crm_people.source first-touch through reuseSourcePatch (a later door lands as a source:<door> tag), never overwrite it with the latest door (FUNNEL-4).',
    )
  }

  // ── FUNNEL-1 (visibility audit 2026-09-22): the intake screen is wired end to end ──
  // 44 of 47 contact-form arrivals in 30 days were scripted; each got a workflow,
  // three broker texts and a task. The screen tags quality:suspect at the chokepoint;
  // every machine that acts on a new lead must read the tag.
  const SCREEN_WIRING = [
    ['lib/crm/send-event.ts', /ensureNativeLead\(\{[^}]*\bscreen\b/, 'forwards the intake `screen` to ensureNativeLead'],
    ['lib/data/crm/ensureNativeLead.ts', /classifyLeadQuality\(/, 'runs classifyLeadQuality on a screened submit'],
    ['lib/data/crm/ensureNativeLead.ts', /hasSuspectTag\(person\?\.tags\)/, 'createNativeTask skips a quality:suspect person'],
    ['app/contact/actions.ts', /formData\.get\(CONTACT_TRAP\.name\)/, 'reads the contact-form honeypot'],
    ['app/contact/actions.ts', /screen:\s*\{\s*honeypot/, 'passes the honeypot to the intake screen'],
    ['app/contact/_v3/ContactAsk.client.tsx', /name=\{CONTACT_TRAP\.name\}/, 'renders the honeypot inside the form'],
    ['app/contact/_v3/ContactAsk.client.tsx', /formData\.set\(CONTACT_TRAP\.name/, 'forwards the honeypot value verbatim'],
    ['lib/crm/enroll.ts', /hasSuspectTag\(tags\)/, 'autoEnrollPerson refuses a quality:suspect person'],
    ['lib/crm/broker-alerts.ts', /isSuspectSilencedAlertKind\(params\.kind\)/, 'queueBrokerAlert silences lead pings for a quality:suspect person'],
    ['lib/crm/response-clock-run.ts', /hasSuspectTag\(tags\)/, 'the response clock leaves a quality:suspect person off the clock'],
    ['app/api/cron/visitor-hot-lead-escalation/route.ts', /person\?\.suspect/, 'hot-lead escalation skips a quality:suspect person'],
  ]
  for (const [rel, re, what] of SCREEN_WIRING) {
    const src = readRepoFile(rel) ?? ''
    if (!re.test(src)) {
      fails.push(`${rel}: no longer ${what} (FUNNEL-1 intake screen, lib/crm/lead-quality.ts).`)
    }
  }

  if (fails.length) {
    console.error(`\n✗ crm-lead-integrity: ${fails.length} issue(s):\n`)
    for (const f of fails) console.error('  • ' + f + '\n')
    process.exit(1)
  }
  const tracked = KNOWN_PEOPLE_POST.size
  console.log(
    `✓ crm-lead-integrity: leads use sendEvent → crm_people, source is required and names the door, every lead-creation path tags an audience.` +
      (tracked ? ` ${tracked} file keeps a documented /people fallback.` : ''),
  )
}
