#!/usr/bin/env node
/**
 * check-broker-agent-send-safety.mjs — CI gate (`ci:broker-agent-send-safety`).
 *
 * Pins docs/plans/BROKER_SMS_AGENT_2026-07-31.md R1.2 / R5.3 / DONE item 6:
 * "The agent's outbound send path is mechanically incapable of texting a
 * non-broker number (whitelist enforced in code + CI gate)." lib/agent/send.ts
 * is the ONE module the broker SMS agent tree may call to actually send an
 * SMS; everything else in lib/agent/ and lib/data/agent/ must go through it.
 * AST-based (TypeScript compiler), never regex-over-text for the import scan —
 * a string match on "sendSms" would also hit comments and unrelated
 * identifiers; a real parse does not.
 *
 * Four checks, no baseline — this either holds or it doesn't:
 *
 *   1. lib/agent/send.ts exists, imports `sendSms` from '@/lib/crm/twilio',
 *      never imports `sendGovernedSms` (that helper's quiet-hours bypass is
 *      for GOVERNED client sends — every agent recipient is an internal
 *      broker, so the agent must never reach for it), contains a whitelist
 *      check, exports exactly one "send*" function, and — structurally,
 *      within that function's body — the whitelist check and a throw
 *      statement both precede the actual `sendSms(...)` call. If the send
 *      call is reachable before the guard runs, the "cannot be reached
 *      without it" invariant is broken no matter how the whitelist itself is
 *      implemented.
 *
 *   2. No other file under lib/agent/ or lib/data/agent/ imports `sendSms` or
 *      `sendSmsViaMessagingService` from '@/lib/crm/twilio' — a second import
 *      site is a second, unguarded send path.
 *
 *   3. app/api/cron/producer-runtime/route.ts's broker-notify hook (R3.1) must
 *      route through '@/lib/agent/send' once it exists — checked ONLY when
 *      the string `requested_by_cell` appears in the file (that hook may not
 *      be built yet; a parallel worker owns it). scripts/render-worker.mjs is
 *      explicitly out of scope for this specific sub-check per the plan.
 *
 *   4. app/api/twilio/inbound-sms/route.ts: if it references
 *      `handleAgentInbound`, it must gate that branch on
 *      `BROKER_SMS_AGENT_ENABLED` — the global kill switch (R1.4).
 *
 * If lib/agent/send.ts does not exist at all, the gate fails immediately with
 * a single, unambiguous message (checks 2-4 do not run — there's nothing to
 * scan a bypass of yet).
 *
 * Usage:
 *   node scripts/check-broker-agent-send-safety.mjs            # CI mode
 *   node scripts/check-broker-agent-send-safety.mjs --report    # human, exit 0
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SEND_FILE = 'lib/agent/send.ts'
const SCAN_DIRS = ['lib/agent', 'lib/data/agent']
const PRODUCER_RUNTIME = 'app/api/cron/producer-runtime/route.ts'
const INBOUND_SMS = 'app/api/twilio/inbound-sms/route.ts'
const TWILIO_MODULE_RE = /(^@\/)?lib\/crm\/twilio$/
const WHITELIST_RE = /isWhitelistedBrokerCell|assertBrokerCell|brokerCellSet|isBrokerCell/

const REPORT = process.argv.includes('--report')
const problems = []
const passes = []

function resolvesToTwilio(spec) {
  return spec === '@/lib/crm/twilio' || TWILIO_MODULE_RE.test(spec) || /(^|\/)lib\/crm\/twilio$/.test(spec)
}

function parse(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return null
  const src = readFileSync(abs, 'utf8')
  return ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function walk(node, fn) {
  fn(node)
  node.forEachChild((c) => walk(c, fn))
}

/** Named imports of `stmt` as `{ localName -> importedName }`, skipping type-only. */
function namedImports(stmt) {
  const out = []
  const clause = stmt.importClause
  if (!clause || clause.isTypeOnly) return out
  const named = clause.namedBindings
  if (!named || !ts.isNamedImports(named)) return out
  for (const el of named.elements) {
    if (el.isTypeOnly) continue
    out.push((el.propertyName ?? el.name).text)
  }
  return out
}

function listTsFiles(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const entry of readdirSync(abs)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const rel = join(dir, entry)
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) listTsFiles(rel, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(rel)
  }
  return out
}

/**
 * Every module binding in `sf` that names one or more identifiers imported
 * FROM a string-literal module specifier — static `import { a, b } from '…'`
 * AND dynamic `const { a } = await import('…')` (the pattern
 * app/api/cron/producer-runtime/route.ts and app/api/twilio/inbound-sms/route.ts
 * both use for code-split, non-circular imports). A regex/text scan would
 * miss the dynamic form entirely; this walks the real AST for it.
 */
function collectModuleBindings(sf) {
  const out = []
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteralLike(stmt.moduleSpecifier)) {
      out.push({ spec: stmt.moduleSpecifier.text, names: namedImports(stmt), node: stmt })
    }
  }
  walk(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isImportCall(n)) return
    const arg = n.arguments[0]
    if (!arg || !ts.isStringLiteralLike(arg)) return
    const spec = arg.text
    // `const { a } = await import('…')` or the un-awaited `const { a } = import('…')`.
    let target = n
    if (target.parent && ts.isAwaitExpression(target.parent)) target = target.parent
    const varDecl = target.parent && ts.isVariableDeclaration(target.parent) ? target.parent : null
    const names = []
    if (varDecl && ts.isObjectBindingPattern(varDecl.name)) {
      for (const el of varDecl.name.elements) {
        const nameNode = el.propertyName ?? el.name
        if (ts.isIdentifier(nameNode)) names.push(nameNode.text)
      }
    }
    out.push({ spec, names, node: n })
  })
  return out
}

function resolvesToAgentSend(spec) {
  return spec === '@/lib/agent/send' || /(^|\/)lib\/agent\/send$/.test(spec)
}

// ── Check 1: lib/agent/send.ts exists and is structurally safe ─────────────
if (!existsSync(join(ROOT, SEND_FILE))) {
  problems.push('lib/agent/send.ts missing — the broker SMS agent transport is not built or was deleted')
} else {
  const sf = parse(SEND_FILE)
  const src = readFileSync(join(ROOT, SEND_FILE), 'utf8')

  let importsSendSms = false
  let importsSendGovernedSms = false
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteralLike(stmt.moduleSpecifier)) continue
    const spec = stmt.moduleSpecifier.text
    const toTwilio = resolvesToTwilio(spec)
    for (const name of namedImports(stmt)) {
      if (name === 'sendSms' && toTwilio) importsSendSms = true
      if (name === 'sendGovernedSms') importsSendGovernedSms = true
    }
  }

  if (!importsSendSms) {
    problems.push(`${SEND_FILE}: does not import \`sendSms\` from '@/lib/crm/twilio' — cannot verify it sends through the shared Twilio helper.`)
  } else {
    passes.push(`${SEND_FILE}: imports \`sendSms\` from '@/lib/crm/twilio'.`)
  }

  if (importsSendGovernedSms) {
    problems.push(`${SEND_FILE}: imports \`sendGovernedSms\` — that helper's quiet-hours bypass is for GOVERNED (client) sends; the agent's sender must never touch it.`)
  } else {
    passes.push(`${SEND_FILE}: does not import \`sendGovernedSms\`.`)
  }

  const whitelistMatch = src.match(WHITELIST_RE)
  const whitelistFnName = whitelistMatch ? whitelistMatch[0] : null
  if (!whitelistFnName) {
    problems.push(
      `${SEND_FILE}: no whitelist-check reference found (expected one of isWhitelistedBrokerCell / assertBrokerCell / brokerCellSet / isBrokerCell).`,
    )
  } else {
    passes.push(`${SEND_FILE}: whitelist-check reference found (\`${whitelistFnName}\`).`)
  }

  // Exactly one exported "send*" function (function declaration, or a const
  // bound to an arrow/function expression).
  const exportedSendFns = []
  walk(sf, (n) => {
    const mods = ts.canHaveModifiers(n) ? (ts.getModifiers(n) ?? []) : []
    const isExported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!isExported) return
    if (ts.isFunctionDeclaration(n) && n.name && /^send/i.test(n.name.text)) {
      exportedSendFns.push({ name: n.name.text, body: n.body })
    }
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (
          ts.isIdentifier(d.name) &&
          /^send/i.test(d.name.text) &&
          d.initializer &&
          (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))
        ) {
          const b = d.initializer.body
          exportedSendFns.push({ name: d.name.text, body: ts.isBlock(b) ? b : null })
        }
      }
    }
  })

  if (exportedSendFns.length !== 1) {
    problems.push(
      `${SEND_FILE}: expected exactly ONE exported send function, found ${exportedSendFns.length}` +
        `${exportedSendFns.length ? ` (${exportedSendFns.map((f) => f.name).join(', ')})` : ''} — a second sender is a second, unguarded path.`,
    )
  } else {
    const { name: sendFnName, body } = exportedSendFns[0]
    passes.push(`${SEND_FILE}: exactly one exported send function (\`${sendFnName}\`).`)

    let whitelistPos = -1
    let throwPos = -1
    let sendCallPos = -1
    if (body) {
      walk(body, (n) => {
        if (whitelistFnName && ts.isIdentifier(n) && n.text === whitelistFnName && whitelistPos === -1) {
          whitelistPos = n.getStart(sf)
        }
        if (ts.isThrowStatement(n) && throwPos === -1) {
          throwPos = n.getStart(sf)
        }
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'sendSms' && sendCallPos === -1) {
          sendCallPos = n.getStart(sf)
        }
      })
    } else {
      problems.push(`${SEND_FILE}: \`${sendFnName}\` has no inspectable block body — cannot verify send ordering.`)
    }

    if (body) {
      if (sendCallPos === -1) {
        problems.push(`${SEND_FILE}: \`${sendFnName}\` never calls sendSms(...) directly — cannot verify send ordering.`)
      } else {
        if (throwPos === -1) {
          problems.push(`${SEND_FILE}: \`${sendFnName}\` has no throw statement — nothing stops a call reaching sendSms() unconditionally.`)
        } else if (throwPos > sendCallPos) {
          problems.push(`${SEND_FILE}: the throw statement in \`${sendFnName}\` appears AFTER the sendSms(...) call — the send is reachable before the guard fires.`)
        } else {
          passes.push(`${SEND_FILE}: the throw statement in \`${sendFnName}\` precedes the sendSms(...) call.`)
        }

        if (!whitelistFnName) {
          // already reported above
        } else if (whitelistPos === -1) {
          problems.push(`${SEND_FILE}: \`${sendFnName}\` never references the whitelist check (\`${whitelistFnName}\`) — the guard is not wired into this function.`)
        } else if (whitelistPos > sendCallPos) {
          problems.push(`${SEND_FILE}: the whitelist check (\`${whitelistFnName}\`) in \`${sendFnName}\` runs AFTER the sendSms(...) call.`)
        } else {
          passes.push(`${SEND_FILE}: the whitelist check (\`${whitelistFnName}\`) in \`${sendFnName}\` precedes the sendSms(...) call.`)
        }
      }
    }
  }
}

// ── Check 2: no other file under lib/agent/ or lib/data/agent/ sends directly ─
if (existsSync(join(ROOT, SEND_FILE))) {
  const bypassSites = []
  for (const dir of SCAN_DIRS) {
    for (const rel of listTsFiles(dir)) {
      if (rel === SEND_FILE) continue
      const sf = parse(rel)
      if (!sf) continue
      for (const binding of collectModuleBindings(sf)) {
        if (!resolvesToTwilio(binding.spec)) continue
        for (const name of binding.names) {
          if (name === 'sendSms' || name === 'sendSmsViaMessagingService') {
            const line = sf.getLineAndCharacterOfPosition(binding.node.getStart(sf)).line + 1
            bypassSites.push(`${rel}:${line} imports \`${name}\` from '@/lib/crm/twilio'`)
          }
        }
      }
    }
  }
  if (bypassSites.length) {
    for (const site of bypassSites) {
      problems.push(`${site} — only ${SEND_FILE} may call the Twilio sender directly.`)
    }
  } else {
    passes.push(`No file under ${SCAN_DIRS.join(', ')} other than ${SEND_FILE} imports sendSms/sendSmsViaMessagingService.`)
  }
}

// ── Check 3: producer-runtime broker-notify (tolerant — hook may not exist yet) ─
if (existsSync(join(ROOT, PRODUCER_RUNTIME))) {
  const src = readFileSync(join(ROOT, PRODUCER_RUNTIME), 'utf8')
  if (src.includes('requested_by_cell')) {
    const sf = parse(PRODUCER_RUNTIME)
    const importsAgentSend = collectModuleBindings(sf).some((b) => resolvesToAgentSend(b.spec))
    if (!importsAgentSend) {
      problems.push(
        `${PRODUCER_RUNTIME}: references \`requested_by_cell\` (the broker-notify hook) but does not import from '@/lib/agent/send' — the notify path must route through the whitelisted sender, not a raw Twilio call.`,
      )
    } else {
      passes.push(`${PRODUCER_RUNTIME}: broker-notify hook imports from '@/lib/agent/send'.`)
    }
  } else {
    passes.push(`${PRODUCER_RUNTIME}: no \`requested_by_cell\` reference yet — broker-notify hook not built; check 3 tolerantly skipped.`)
  }
} else {
  passes.push(`${PRODUCER_RUNTIME} does not exist — check 3 skipped.`)
}

// ── Check 4: inbound-sms gates the agent branch on the env kill switch ──────
if (existsSync(join(ROOT, INBOUND_SMS))) {
  const src = readFileSync(join(ROOT, INBOUND_SMS), 'utf8')
  if (src.includes('handleAgentInbound')) {
    if (!src.includes('BROKER_SMS_AGENT_ENABLED')) {
      problems.push(
        `${INBOUND_SMS}: references \`handleAgentInbound\` but never checks \`BROKER_SMS_AGENT_ENABLED\` — the global kill switch (R1.4) is not gating the agent branch.`,
      )
    } else {
      passes.push(`${INBOUND_SMS}: \`handleAgentInbound\` branch is gated on \`BROKER_SMS_AGENT_ENABLED\`.`)
    }
  } else {
    passes.push(`${INBOUND_SMS}: no \`handleAgentInbound\` reference yet — agent ingress not wired; check 4 tolerantly skipped.`)
  }
} else {
  problems.push(`${INBOUND_SMS} is missing — the inbound SMS webhook does not exist.`)
}

if (REPORT) {
  console.log('Broker-agent send-safety gate (ci:broker-agent-send-safety) — report mode')
  console.log('============================================================================')
  for (const p of passes) console.log(`  ✓ ${p}`)
  for (const p of problems) console.log(`  ✗ ${p}`)
  process.exit(0)
}

if (problems.length) {
  console.error('ci:broker-agent-send-safety FAILED — the broker-cell whitelist invariant is not intact:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}

for (const p of passes) console.log(`  ✓ ${p}`)
console.log(`✓ ci:broker-agent-send-safety passed — ${passes.length} check(s), the agent cannot text a non-broker number.`)
