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
 * Read under any local name: an aliased import, a destructured dynamic import,
 * a const that holds one.
 */
const SOURCE_WRITERS = new Set(['sendEvent', 'ensureNativeLead'])

/** lib/site-origin.ts, the one place the host comes from (2026-10-07), and the retired websiteSource(). */
const HOST_FUNCS = new Set(['siteHost', 'siteOrigin', 'siteUrl', 'configuredSiteOrigin', 'websiteSource'])

/**
 * A string that is the site's host or a URL, never a door. The host forms are
 * isSiteHostSource's (lib/crm/lead-source.ts); the gate's test holds the two together.
 */
export function isHostLiteral(text) {
  const s = String(text).trim().toLowerCase()
  return /ryan-?realty\.(?:com|vercel\.app)/.test(s) || /^localhost(?::\d+)?$/.test(s) || /^https?:\/\//.test(s)
}

/** A fixed lead-in that could still begin the host or a URL. */
const HOST_LEAD_IN = /^(?:https?:|www\.|localhost|(?:[a-z0-9-]+\.)*ryan-?realty)/i

/**
 * Writes whose source is not a door label this gate can read, each scoped to
 * its file and to its source expression as written, with the reason. `kind` is
 * exactly what the write needs: 'host' (it may carry the site host), 'opaque'
 * (its value is not readable here; the reason says why it still names a door)
 * or 'host+opaque'. An entry that matches no write needing that kind fails, so
 * the list only describes code that exists. An empty source is never allowed.
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

const ASSIGN_OPS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
])

function unwrap(node) {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isAwaitExpression(node)
  ) {
    node = node.expression
  }
  return node
}

/** A property's key as text: `source`, `'source'`, `['source']`. */
function keyOf(p) {
  const n = p.name
  if (!n) return null
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text
  if (ts.isComputedPropertyName(n) && (ts.isStringLiteral(n.expression) || ts.isNoSubstitutionTemplateLiteral(n.expression))) return n.expression.text
  return null
}

const leaf = (kind, text, partial = false) => ({ kind, text: String(text).replace(/\s+/g, ' '), ...(partial ? { partial } : {}) })
const literalLeaf = (text) => leaf(!String(text).trim() ? 'empty' : isHostLiteral(text) ? 'host' : 'label', text)
const hasHost = (leaves) => leaves.some((l) => l.kind === 'host')

/**
 * Reads each write's source on the syntax tree, each file bound alone by the
 * TypeScript checker (no lib, no module resolution), so every name resolves to
 * the declaration in scope where it is used. Imports are followed by hand
 * through export aliases, re-exports and `export *`. A comment, a nested
 * campaign.source or a `message: source` value is never taken for the key.
 */
function sourceProject(read) {
  const modules = new Map()

  function load(rel) {
    if (modules.has(rel)) return modules.get(rel)
    let mod = null
    const text = read(rel)
    if (text != null) {
      const path = `/${rel}`
      const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      const host = {
        getSourceFile: (name, version) => (name === path ? ts.createSourceFile(name, text, version, true, kind) : undefined),
        getDefaultLibFileName: () => '/lib.d.ts',
        writeFile: () => {},
        getCurrentDirectory: () => '/',
        getDirectories: () => [],
        fileExists: (name) => name === path,
        readFile: (name) => (name === path ? text : undefined),
        getCanonicalFileName: (name) => name,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
      }
      const program = ts.createProgram({ rootNames: [path], options: { noResolve: true, noLib: true, types: [] }, host })
      mod = { rel, sf: program.getSourceFile(path), checker: program.getTypeChecker(), memo: new Map(), assigns: null }
    }
    modules.set(rel, mod)
    return mod
  }

  /** Every assignment to a variable in the file, by symbol: x = …, x ||= …, x += …. */
  function assignmentsTo(sym, mod) {
    if (!mod.assigns) {
      mod.assigns = new Map()
      const visit = (node) => {
        if (ts.isBinaryExpression(node) && ASSIGN_OPS.has(node.operatorToken.kind) && ts.isIdentifier(node.left)) {
          const s = mod.checker.getSymbolAtLocation(node.left)
          if (s) mod.assigns.set(s, [...(mod.assigns.get(s) ?? []), node])
        }
        ts.forEachChild(node, visit)
      }
      visit(mod.sf)
    }
    return mod.assigns.get(sym) ?? []
  }

  /** The object literal an expression is: written inline, or a const never reassigned. */
  function objectLiteralOf(node, mod, depth = 0) {
    node = unwrap(node)
    if (ts.isObjectLiteralExpression(node)) return node
    if (depth > 4 || !ts.isIdentifier(node)) return null
    const sym = mod.checker.getSymbolAtLocation(node)
    const decls = sym?.declarations ?? []
    if (decls.length !== 1 || !ts.isVariableDeclaration(decls[0]) || !decls[0].initializer || assignmentsTo(sym, mod).length) return null
    return objectLiteralOf(decls[0].initializer, mod, depth + 1)
  }

  /**
   * What `obj[key]` can hold for an object literal: its last own property of
   * that key, joined by any spread after it that may override it. Null when
   * nothing in the literal can supply the key.
   */
  function propertyLeaves(obj, key, mod, depth = 0) {
    let out = null
    for (const p of obj.properties) {
      if (ts.isSpreadAssignment(p)) {
        const inner = depth < 4 ? objectLiteralOf(p.expression, mod) : null
        const more = inner ? propertyLeaves(inner, key, mod, depth + 1) : [leaf('opaque', `...${p.expression.getText(mod.sf)}`)]
        if (more) out = [...(out ?? []), ...more]
      } else if (keyOf(p) === key) {
        if (ts.isPropertyAssignment(p)) out = leaves(p.initializer, mod)
        else if (ts.isShorthandPropertyAssignment(p)) out = symbolLeaves(mod.checker.getShorthandAssignmentValueSymbol(p), mod, p.name.text)
        else out = [leaf('opaque', p.getText(mod.sf))]
      }
    }
    return out
  }

  /** What a symbol can hold: its declarations' values plus every assignment to it. */
  function symbolLeaves(sym, mod, name) {
    if (!sym) return [leaf('opaque', name)]
    if (mod.memo.has(sym)) return mod.memo.get(sym) ?? []
    mod.memo.set(sym, null)
    const out = []
    for (const d of sym.declarations ?? []) {
      if (ts.isVariableDeclaration(d)) {
        const owner = d.parent
        const loopVar = ts.isVariableDeclarationList(owner) && (ts.isForOfStatement(owner.parent) || ts.isForInStatement(owner.parent))
        if (loopVar || ts.isCatchClause(owner)) out.push(leaf('opaque', name))
        else if (d.initializer) out.push(...leaves(d.initializer, mod))
      } else if (ts.isBindingElement(d)) {
        // const { source } = { … }: the property of the literal it destructures, else opaque.
        const pattern = d.parent
        const decl = pattern?.parent
        const key = d.propertyName ? keyOf({ name: d.propertyName }) : ts.isIdentifier(d.name) ? d.name.text : null
        const obj = ts.isObjectBindingPattern(pattern) && decl && ts.isVariableDeclaration(decl) && decl.initializer && key ? objectLiteralOf(decl.initializer, mod) : null
        out.push(...((obj && propertyLeaves(obj, key, mod)) ?? [leaf('opaque', name)]))
        if (d.initializer) out.push(...leaves(d.initializer, mod))
      } else if (ts.isImportSpecifier(d)) {
        out.push(...importLeaves(d, mod))
      } else if (ts.isExportSpecifier(d)) {
        out.push(...symbolLeaves(mod.checker.getExportSpecifierLocalTargetSymbol(d), mod, name))
      } else if (ts.isEnumMember(d) && d.initializer) {
        out.push(...leaves(d.initializer, mod))
      } else {
        // A parameter, a default or namespace import, a function or class.
        out.push(leaf('opaque', name))
      }
    }
    for (const a of assignmentsTo(sym, mod)) {
      const right = leaves(a.right, mod)
      if (a.operatorToken.kind !== ts.SyntaxKind.PlusEqualsToken) out.push(...right)
      else out.push(leaf(hasHost(right) ? 'host' : 'opaque', a.getText(mod.sf)))
    }
    const result = out.length ? out : [leaf('opaque', name)]
    mod.memo.set(sym, result)
    return result
  }

  function importLeaves(spec, mod) {
    const decl = spec.parent?.parent?.parent
    const from = decl && ts.isImportDeclaration(decl) && ts.isStringLiteral(decl.moduleSpecifier) ? decl.moduleSpecifier.text : null
    const target = from && resolveModule(from, mod.rel, read)
    const name = (spec.propertyName ?? spec.name).text
    return (target && exportLeaves(target, name, 0)) ?? [leaf('opaque', spec.name.text)]
  }

  /** What module `rel` exports as `name`, through export aliases, re-exports and `export *`; null when it does not. */
  function exportLeaves(rel, name, depth) {
    const m = depth < 8 ? load(rel) : null
    const modSym = m && m.checker.getSymbolAtLocation(m.sf)
    if (!modSym) return null
    const exp = m.checker.getExportsOfModule(modSym).find((s) => s.name === name)
    if (exp) {
      const d = exp.declarations?.[0]
      const from = d && ts.isExportSpecifier(d) ? d.parent.parent.moduleSpecifier : null
      if (from && ts.isStringLiteral(from)) {
        const next = resolveModule(from.text, rel, read)
        return (next && exportLeaves(next, (d.propertyName ?? d.name).text, depth + 1)) ?? [leaf('opaque', name)]
      }
      return symbolLeaves(exp, m, name)
    }
    for (const st of m.sf.statements) {
      if (ts.isExportDeclaration(st) && !st.exportClause && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
        const next = resolveModule(st.moduleSpecifier.text, rel, read)
        const found = next && exportLeaves(next, name, depth + 1)
        if (found) return found
      }
    }
    return null
  }

  /** The name a callee was imported or declared under, for a call through an alias. */
  function originalName(callee, mod) {
    callee = unwrap(callee)
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text
    if (!ts.isIdentifier(callee)) return null
    const d = mod.checker.getSymbolAtLocation(callee)?.declarations?.[0]
    if (d && (ts.isImportSpecifier(d) || ts.isBindingElement(d)) && d.propertyName) return d.propertyName.getText(mod.sf)
    return callee.text
  }

  /** The source writer a callee is (sendEvent / ensureNativeLead), under any local name; null otherwise. */
  function writerName(callee, mod, depth = 0) {
    callee = unwrap(callee)
    const name = originalName(callee, mod)
    if (SOURCE_WRITERS.has(name)) return name
    if (!ts.isIdentifier(callee) || depth > 3) return null
    for (const d of mod.checker.getSymbolAtLocation(callee)?.declarations ?? []) {
      if (ts.isVariableDeclaration(d) && d.initializer) {
        const held = writerName(d.initializer, mod, depth + 1)
        if (held) return held
      }
    }
    return null
  }

  /**
   * A string built from pieces (`a + b`, a template literal): the host if any
   * piece is; every spelling it can take when each piece reads to labels; else
   * a label when a fixed lead-in names the door (`Facebook Lead Ad — ${campaign}`).
   */
  function joined(parts, node, mod) {
    const text = node.getText(mod.sf)
    let spellings = ['']
    for (const part of parts) {
      if (typeof part === 'string') {
        if (spellings) spellings = spellings.map((s) => s + part)
        continue
      }
      const ls = leaves(part, mod)
      if (hasHost(ls)) return [leaf('host', text)]
      const readable = ls.every((l) => (l.kind === 'label' && !l.partial) || l.kind === 'empty')
      spellings = readable && spellings && spellings.length * ls.length <= 32
        ? spellings.flatMap((s) => ls.map((l) => s + (l.kind === 'empty' ? '' : l.text)))
        : null
    }
    if (spellings) return spellings.map(literalLeaf)
    const leadIn = typeof parts[0] === 'string' ? parts[0].trim() : ''
    if (!leadIn) return [leaf('opaque', text)]
    return [HOST_LEAD_IN.test(leadIn) ? leaf('host', text) : leaf('label', text, true)]
  }

  /** The operands of an `a + b + c` chain, string literals as text. */
  function plusParts(node) {
    node = unwrap(node)
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return [...plusParts(node.left), ...plusParts(node.right)]
    return [ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : node]
  }

  /**
   * What an expression can evaluate to, as leaves: 'label' (a door name), 'host'
   * (the site's host or a URL), 'empty' (names no door) or 'opaque' (a
   * parameter, a call or a property this gate cannot read).
   */
  function leaves(node, mod) {
    node = unwrap(node)
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [literalLeaf(node.text)]
    if (ts.isIdentifier(node)) {
      if (node.text === 'undefined') return [leaf('empty', 'undefined')]
      return symbolLeaves(mod.checker.getSymbolAtLocation(node), mod, node.text)
    }
    if (ts.isConditionalExpression(node)) return [...leaves(node.whenTrue, mod), ...leaves(node.whenFalse, mod)]
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.AmpersandAmpersandToken) {
        return [...leaves(node.left, mod), ...leaves(node.right, mod)]
      }
      if (op === ts.SyntaxKind.PlusToken) return joined(plusParts(node), node, mod)
    }
    if (ts.isTemplateExpression(node)) {
      return joined([node.head.text, ...node.templateSpans.flatMap((s) => [s.expression, s.literal.text])], node, mod)
    }
    const text = node.getText(mod.sf)
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && /\bNEXT_PUBLIC_SITE_URL\b/.test(text)) {
      return [leaf('host', text)]
    }
    if (ts.isPropertyAccessExpression(node)) {
      const obj = objectLiteralOf(node.expression, mod)
      if (obj) return propertyLeaves(obj, node.name.text, mod) ?? [leaf('opaque', text)]
      // new URL(siteOrigin()).host, base.hostname: a part of the host is the host.
      return [leaf(hasHost(leaves(node.expression, mod)) ? 'host' : 'opaque', text)]
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = unwrap(node.expression)
      const host =
        HOST_FUNCS.has(originalName(callee, mod)) ||
        // base.replace(…), origin.toLowerCase(): the host, reshaped.
        (ts.isPropertyAccessExpression(callee) && hasHost(leaves(callee.expression, mod))) ||
        // pick(utm, siteHost()): a host passed in may be what comes back.
        (node.arguments ?? []).some((a) => hasHost(leaves(a, mod)))
      return [leaf(host ? 'host' : 'opaque', text)]
    }
    return [leaf('opaque', text)]
  }

  /** Each crm_people.source write in a file, with the source as written and what it can hold. */
  function writes(rel) {
    const mod = load(rel)
    if (!mod) return []
    const out = []
    const visit = (node) => {
      const callee = ts.isCallExpression(node) ? writerName(node.expression, mod) : null
      const arg = callee ? node.arguments[0] : null
      if (arg) {
        const line = mod.sf.getLineAndCharacterOfPosition(node.getStart(mod.sf)).line + 1
        const obj = objectLiteralOf(arg, mod)
        if (!obj) {
          out.push({ callee, line, expr: arg.getText(mod.sf).replace(/\s+/g, ' '), leaves: [leaf('opaque', arg.getText(mod.sf))] })
        } else {
          const ls = propertyLeaves(obj, 'source', mod)
          if (ls) {
            const own = [...obj.properties].reverse().find((p) => !ts.isSpreadAssignment(p) && keyOf(p) === 'source')
            const expr = !own ? arg.getText(mod.sf) : ts.isPropertyAssignment(own) ? own.initializer.getText(mod.sf) : ts.isShorthandPropertyAssignment(own) ? own.name.text : own.getText(mod.sf)
            out.push({ callee, line, expr: expr.replace(/\s+/g, ' '), leaves: ls })
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(mod.sf)
    return out
  }

  return { writes }
}

/** Each sendEvent / ensureNativeLead in one file, with the source expression and what it can hold. */
export function sourceWrites(rel, read = readRepoFile) {
  return sourceProject(read).writes(rel)
}

/** What a write needs allowed: 'host', 'opaque', 'host+opaque', or null for door labels only. */
function neededKind(leaves) {
  return ['host', 'opaque'].filter((k) => leaves.some((l) => l.kind === k)).join('+') || null
}

/**
 * The FUNNEL-4 failures across `files`: a write whose source can be empty, the
 * site host, or not read down to a door label, unless `allowed` names that file
 * and expression with exactly the kind it needs; and an allowance no write needs.
 */
export function sourceWriteFailures(files, { read = readRepoFile, allowed = SOURCE_ALLOWED } = {}) {
  const project = sourceProject(read)
  const fails = []
  const used = new Set()
  const scanned = new Set(files)
  for (const rel of files) {
    const text = read(rel)
    if (text == null || !/\b(?:sendEvent|ensureNativeLead)\b/.test(text)) continue
    for (const w of project.writes(rel)) {
      const at = `${rel}:${w.line}: ${w.callee} source \`${w.expr}\``
      if (w.leaves.some((l) => l.kind === 'empty')) {
        fails.push(`${at} can be empty, which names no door. Write the door label (FUNNEL-4).`)
      }
      const need = neededKind(w.leaves)
      if (need === null) continue
      const allowance = allowed[rel]?.[w.expr]
      if (allowance?.kind === need) {
        used.add(`${rel}\n${w.expr}`)
        continue
      }
      const unread = w.leaves.filter((l) => l.kind === 'opaque').map((l) => l.text)
      if (need.includes('host')) {
        fails.push(
          `${at} can be the site host${unread.length ? `, or values this gate cannot read (${unread.join(', ')})` : ''}. Write the door label ('contact-form', 'idx-registration', 'seller-lp', 'buyer-lp', 'place-page', 'published-cma', ...) so crm_people.source says which form it was (FUNNEL-4), or allow it in SOURCE_ALLOWED as kind '${need}' with the reason it is not a door.`,
        )
      } else {
        fails.push(
          `${at} does not read down to a door label (${unread.join(', ')}). Name the door with a string or a const, or allow it in SOURCE_ALLOWED as kind 'opaque' with the reason it names a door (FUNNEL-4).`,
        )
      }
    }
  }
  for (const [rel, entries] of Object.entries(allowed)) {
    for (const [expr, { kind }] of Object.entries(entries)) {
      if (!used.has(`${rel}\n${expr}`)) {
        fails.push(
          `${rel}: SOURCE_ALLOWED allows \`${expr}\` (${kind}), but ${scanned.has(rel) ? `no write there needs exactly a '${kind}' allowance` : 'the file is not scanned'}. Remove or correct the entry.`,
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
