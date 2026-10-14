#!/usr/bin/env node
/**
 * check-video-freeze.mjs — ci:video-freeze (G83). The video freeze stays wired.
 *
 * Matt 2026-10-14, "Freeze it now": until the new content process with its
 * server-signed certificate is live, no video reaches his approval queue or a
 * social channel by the old studio path (/admin/studio -> lib/studio/produce.ts
 * -> approveStudioDraft -> publisher-sweep -> /api/social/publish), nor by the
 * doors beside it that feed the same sweep (Today's Imagine listing clip, the
 * approval queue, the SMS APPROVE), nor by the scripts that post video to a
 * platform directly (scripts/upload-youtube.mjs, scripts/create-fb-ad.mjs and
 * lib/meta-marketing-api.mjs). lib/content/video-freeze.ts answers "is this
 * video?" (failing closed); this gate fails if any choke point stops asking,
 * so the freeze cannot be quietly removed.
 *
 * RETIRED WHEN the server-signed certificate check replaces the freeze at the
 * same choke points: delete this gate, its package.json/ci-lanes.json entries,
 * its break-tests and lib/content/video-freeze.ts together.
 *
 * Rules (TypeScript AST, so a comment or a string cannot satisfy them):
 *   R0  lib/content/video-freeze.ts exports VIDEO_PUBLISH_FROZEN initialised
 *       to the literal `true`, Matt's message, and the guard functions.
 *   R1  Each choke-point file imports the guard it calls from the module,
 *       as '@/lib/content/video-freeze' or a relative path to
 *       lib/content/video-freeze.ts (a local look-alike does not count).
 *   R2  In each choke point, an `if` whose condition is a guard call (or a
 *       const initialised from one) exits (return / continue / throw /
 *       process.exit) and DOMINATES every guarded write: it sits earlier in a
 *       block that encloses the write, so the write cannot run first or around it.
 *   R3  The publish route's refusal answers 423 Locked.
 *   R4  The bulk approve writes only ids that came out of splitVideoFrozen.
 *   R5  The retired one-off May rollout scripts, which posted Reels straight to
 *       the Graph API, stay deleted.
 *   R6  A direct video-post endpoint ('REELS', /advideos, video_reels,
 *       post/publish/, upload/youtube/v3/videos, tweet_video, videos.insert)
 *       appears only in a guarded choke point or a platform client, so a new
 *       script cannot open a door around the freeze.
 *   R7  The platform clients' video functions (publishReel, directPostVideo,
 *       uploadYouTubeVideoFromUrl, ...) are imported only by the publish
 *       route, which refuses video (R2, R3).
 *
 * Usage:
 *   node scripts/check-video-freeze.mjs            # check (exit 1 on a violation)
 *   node scripts/check-video-freeze.mjs --report   # print, always exit 0
 *   node scripts/check-video-freeze.mjs --json     # machine-readable
 *
 * Break-tests: scripts/__tests__/check-video-freeze.test.mjs.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const GUARD_MODULE = 'lib/content/video-freeze.ts'
export const GUARD_SPECIFIER = '@/lib/content/video-freeze'
export const FREEZE_MESSAGE =
  'Video publishing is frozen until the content process is live (Matt 2026-10-14). Videos go through the content process (docs/plans/STUDIO_ONE_FACTORY.md) and need a server-signed certificate.'
const GUARD_EXPORTS = ['isVideoMedia', 'videoFreezeRefusal', 'rowVideoFreezeRefusal', 'splitVideoFrozen', 'VIDEO_FREEZE_MESSAGE']

/**
 * Every choke point. `writes` picks the calls the guard must dominate:
 *   { callee }                      every call whose callee name is this
 *   { callee, argIncludes }         ...and whose first argument's text includes this
 *   { callee: 'update', approves }  every .update(...) that sets status 'approved'
 */
export const CHOKE_POINTS = [
  // scope: null means the module's top level (a plain-node script).
  {
    file: 'lib/studio/produce.ts',
    scope: 'produceStudioDraft',
    what: 'producing a studio draft (console and slate cron)',
    guard: 'videoFreezeRefusal',
    writes: { callee: 'insertPending' },
  },
  {
    file: 'lib/social/imagine-produce.ts',
    scope: 'produceListing',
    what: "producing Today's Imagine listing clip",
    guard: 'videoFreezeRefusal',
    writes: { callee: 'insertPending' },
  },
  {
    file: 'lib/data/studio/drafts.ts',
    scope: 'approveStudioDraft',
    what: 'approving a studio draft',
    guard: 'rowVideoFreezeRefusal',
    writes: { callee: 'update', approves: true },
  },
  {
    file: 'lib/data/agent/actions.ts',
    scope: 'approveAction',
    what: 'approving a row (SMS APPROVE, approval-queue action, Today Yes)',
    guard: 'rowVideoFreezeRefusal',
    writes: { callee: 'update', approves: true },
  },
  {
    file: 'app/api/admin/approval-queue/[id]/action/route.ts',
    scope: 'POST',
    what: 'approve_now / approve_schedule in the approval queue',
    guard: 'rowVideoFreezeRefusal',
    writes: { callee: 'update', approves: true },
  },
  {
    file: 'app/api/admin/approval-queue/bulk-action/route.ts',
    scope: 'POST',
    what: 'bulk approve in the approval queue',
    guard: 'splitVideoFrozen',
    bulkIds: true,
  },
  {
    file: 'app/api/cron/publisher-sweep/route.ts',
    scope: 'GET',
    what: 'publisher-sweep POSTing a row to the publish route',
    guard: 'videoFreezeRefusal',
    writes: { callee: 'fetch', argIncludes: '/api/social/publish' },
  },
  {
    file: 'app/api/social/publish/route.ts',
    scope: 'POST',
    what: 'the publish route fanning out to the platforms',
    guard: 'videoFreezeRefusal',
    writes: { calleePattern: /^publishTo/ },
    status423: true,
  },
  {
    file: 'scripts/upload-youtube.mjs',
    scope: null,
    what: 'uploading an MP4 to the YouTube channel (private included)',
    guard: 'videoFreezeRefusal',
    writes: { callee: 'insert' },
  },
  {
    file: 'scripts/create-fb-ad.mjs',
    scope: 'main',
    what: 'creating a video lead-gen ad (upload, campaign, ad set, form, creative, ad)',
    guard: 'videoFreezeRefusal',
    writes: { calleePattern: /^(uploadVideo|getOrCreateForm|createCampaign|createAdSet|createAdCreative|createAd|setAdStatus)$/ },
  },
  {
    file: 'lib/meta-marketing-api.mjs',
    scope: 'uploadVideo',
    what: 'uploading a video to the Meta ad account (/advideos)',
    guard: 'videoFreezeRefusal',
    writes: { callee: 'fetch' },
  },
  {
    file: 'lib/meta-marketing-api.mjs',
    scope: 'createAdCreative',
    what: 'building a video_data ad creative',
    guard: 'videoFreezeRefusal',
    writes: { callee: 'apiPost' },
  },
]

/** R5: one-off scripts that posted video around every gate. Deleted 2026-10-14; they stay deleted. */
export const RETIRED_SCRIPTS = ['scripts/publish-2026-05-14-fixes.mjs', 'scripts/publish-2026-05-14-rollout.mjs']

/** R6: string pieces that only a direct video post uses. */
const VIDEO_POST_EXACT = new Set(['REELS', 'tweet_video'])
const VIDEO_POST_PARTS = ['/advideos', 'video_reels', 'post/publish/', 'upload/youtube/v3/videos']

/** R6: where those may appear, and why that is safe. */
export const VIDEO_POST_ALLOWED = new Map([
  ['lib/meta-graph.ts', 'platform client; its video functions are imported only by the publish route (R7)'],
  ['lib/tiktok.ts', 'platform client; its video functions are imported only by the publish route (R7)'],
  ['lib/x.ts', 'platform client; its video functions are imported only by the publish route (R7)'],
  ['lib/youtube.ts', 'platform client; its video functions are imported only by the publish route (R7)'],
  ['lib/meta-marketing-api.mjs', 'uploadVideo and createAdCreative refuse video (choke points above)'],
  ['scripts/upload-youtube.mjs', 'refuses every upload at the top (choke point above)'],
])

/** R7: each platform client's video functions, which only the publish route may import. */
export const PLATFORM_VIDEO_FUNCTIONS = new Map([
  ['lib/meta-graph', ['publishReel', 'publishFacebookReel', 'publishFacebookVideo']],
  ['lib/tiktok', ['initVideoUpload', 'uploadVideoChunk', 'publishVideo', 'directPostVideo']],
  ['lib/youtube', ['uploadYouTubeVideoFromUrl']],
  ['lib/linkedin', ['publishLinkedInVideoFromUrl']],
  ['lib/x', ['uploadVideoToX']],
  ['lib/pinterest', ['createPinterestVideoPin']],
  ['lib/threads', ['publishThreadsVideo']],
])
export const PUBLISH_ROUTE = 'app/api/social/publish/route.ts'

/** Raw text a file must hold before R6/R7 bother parsing it (parsing every file costs ~10s). */
// `.videos` covers `youtube.videos.insert(` and the same chain split across lines.
const R6_HINTS = [...VIDEO_POST_EXACT, ...VIDEO_POST_PARTS, '.videos']
const R7_HINTS = [...PLATFORM_VIDEO_FUNCTIONS.keys()].flatMap((mod) => {
  const base = mod.slice(mod.lastIndexOf('/'))
  return [`${base}'`, `${base}"`, `${base}.ts'`, `${base}.ts"`]
})

/** Code this gate scans for R6 and R7: source under app/, lib/, components/, scripts/; never tests or this gate. */
export function isScannedCode(rel) {
  if (!/^(app|lib|components|scripts)\//.test(rel)) return false
  if (!/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(rel) || rel.endsWith('.d.ts')) return false
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(rel) || rel.includes('/__tests__/')) return false
  return rel !== 'scripts/check-video-freeze.mjs'
}

function parse(rel, src) {
  const kind = /\.[cm]?jsx?$/.test(rel)
    ? rel.endsWith('x')
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.JS
    : rel.endsWith('x')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  return ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, kind)
}

/** The repo path an import specifier points at, without extension, or null for a package. */
function resolveSpecifier(fromRel, spec) {
  let target
  if (spec.startsWith('@/')) target = spec.slice(2)
  else if (spec.startsWith('.')) target = posix.normalize(posix.join(posix.dirname(fromRel), spec))
  else return null
  return target.replace(/\.(ts|tsx|mts|js|mjs|jsx)$/, '').replace(/\/index$/, '')
}

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function calleeName(call) {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text
  return null
}

/** The function (declaration or `const name = (...) =>`) called `name`, or null. A null name is the module itself. */
function findScope(sf, name) {
  if (name === null) return sf
  let found = null
  walk(sf, (node) => {
    if (found) return
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && node.body) found = node.body
    else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      found = node.initializer.body
    }
  })
  return found
}

/** Names imported from the guard module (by alias or by a relative path to it). */
function guardImports(sf, rel) {
  const names = new Set()
  const guardPath = GUARD_MODULE.replace(/\.ts$/, '')
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue
    if (resolveSpecifier(rel, stmt.moduleSpecifier.text) !== guardPath) continue
    const bindings = stmt.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) {
        // `import { x as y }` binds y; only an un-renamed import counts.
        if (!el.propertyName) names.add(el.name.text)
      }
    }
  }
  return names
}

/** True when the file declares its own binding of `name` (a look-alike that would shadow the import). */
function declaresLocally(sf, name) {
  let found = false
  walk(sf, (node) => {
    if (found) return
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === name) {
      found = true
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.name.text === name) found = true
  })
  return found
}

function unwrap(node) {
  let n = node
  while (n && (ts.isParenthesizedExpression(n) || ts.isAwaitExpression(n))) n = n.expression
  return n
}

/** True when `node` IS a call to the guard (not merely contains one). */
function isGuardCall(node, guard) {
  const n = unwrap(node)
  return Boolean(n && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === guard)
}

/**
 * An initializer that carries the guard's answer as is: the call itself, or
 * `cond ? guard(...) : null` (the sweep's "only rows with a payload" shape).
 * `false && guard(...)` and the like do not count.
 */
function isGuardValue(node, guard) {
  const n = unwrap(node)
  if (isGuardCall(n, guard)) return true
  if (n && ts.isConditionalExpression(n)) {
    const isNull = (e) => unwrap(e)?.kind === ts.SyntaxKind.NullKeyword
    return (isGuardCall(n.whenTrue, guard) && isNull(n.whenFalse)) || (isNull(n.whenTrue) && isGuardCall(n.whenFalse, guard))
  }
  return false
}

/** Identifiers in `scope` declared (const/let) straight from the guard's answer. */
function guardDerivedNames(scope, guard) {
  const names = new Set()
  walk(scope, (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && isGuardValue(node.initializer, guard)) {
      if (ts.isIdentifier(node.name)) names.add(node.name.text)
      else if (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name)) {
        for (const el of node.name.elements) if (ts.isBindingElement(el) && ts.isIdentifier(el.name)) names.add(el.name.text)
      }
    }
  })
  return names
}

/** A condition that is the guard's answer: `x`, `guard(...)`, or either `!== null` / `!= null`. */
function isGuardCondition(expr, guard, derived) {
  const n = unwrap(expr)
  const isAnswer = (e) => {
    const u = unwrap(e)
    return isGuardCall(u, guard) || (u && ts.isIdentifier(u) && derived.has(u.text))
  }
  if (isAnswer(n)) return true
  if (
    n &&
    ts.isBinaryExpression(n) &&
    (n.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      n.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken) &&
    unwrap(n.right)?.kind === ts.SyntaxKind.NullKeyword
  ) {
    return isAnswer(n.left)
  }
  return false
}

function referencesAny(node, names) {
  let found = false
  walk(node, (n) => {
    if (!found && ts.isIdentifier(n) && names.has(n.text)) found = true
  })
  return found
}

function exits(stmt) {
  let found = false
  walk(stmt, (n) => {
    if (found) return
    if (ts.isReturnStatement(n) || ts.isContinueStatement(n) || ts.isThrowStatement(n)) found = true
    // A plain-node script leaves with process.exit(...).
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'exit' &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === 'process'
    ) {
      found = true
    }
  })
  return found
}

/** The `if` statements in scope whose condition is the guard's answer and that leave. */
function guardIfs(scope, guard) {
  const derived = guardDerivedNames(scope, guard)
  const out = []
  walk(scope, (node) => {
    if (!ts.isIfStatement(node)) return
    if (isGuardCondition(node.expression, guard, derived) && exits(node.thenStatement)) out.push(node)
  })
  return out
}

function isAncestor(maybeAncestor, node) {
  for (let n = node.parent; n; n = n.parent) if (n === maybeAncestor) return true
  return false
}

/** An if dominates a call when it is earlier in a block (or case) that encloses the call. */
function dominates(ifStmt, call) {
  return isAncestor(ifStmt.parent, call) && ifStmt.getEnd() <= call.getStart()
}

/** The object literal an .update(...) call writes, following one `const x = {...}` hop. */
function updatePatch(call, scope) {
  const arg = call.arguments[0]
  if (!arg) return null
  if (ts.isObjectLiteralExpression(arg)) return arg
  if (ts.isIdentifier(arg)) {
    let lit = null
    walk(scope, (node) => {
      if (!lit && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === arg.text) {
        if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) lit = node.initializer
      }
    })
    return lit
  }
  return null
}

function setsApproved(obj) {
  return obj.properties.some(
    (p) =>
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === 'status' &&
      ts.isStringLiteralLike(p.initializer) &&
      p.initializer.text === 'approved',
  )
}

function writeCalls(scope, writes, sf) {
  const calls = []
  walk(scope, (node) => {
    if (!ts.isCallExpression(node)) return
    const name = calleeName(node)
    if (!name) return
    if (writes.calleePattern) {
      if (writes.calleePattern.test(name)) calls.push(node)
      return
    }
    if (name !== writes.callee) return
    if (writes.argIncludes) {
      const a0 = node.arguments[0]
      if (!a0 || !a0.getText(sf).includes(writes.argIncludes)) return
    }
    if (writes.approves) {
      const patch = updatePatch(node, scope)
      if (!patch || !setsApproved(patch)) return
    }
    calls.push(node)
  })
  return calls
}

function line(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
}

/** R4: the bulk approve's .in('id', X) must take ids derived from splitVideoFrozen. */
function checkBulkIds(sf, scope, guard, rel, problems) {
  const derived = guardDerivedNames(scope, guard)
  // Follow one or more hops: const approvableIds = allowed.map(...)
  let grew = true
  while (grew) {
    grew = false
    walk(scope, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        !derived.has(node.name.text) &&
        node.initializer &&
        referencesAny(node.initializer, derived)
      ) {
        derived.add(node.name.text)
        grew = true
      }
    })
  }
  const approveUpdates = writeCalls(scope, { callee: 'update', approves: true }, sf)
  if (approveUpdates.length === 0) {
    problems.push(`${rel}: no .update({ status: 'approved' }) found in POST; this gate no longer knows where bulk approve writes. Update CHOKE_POINTS.`)
    return
  }
  for (const update of approveUpdates) {
    // Walk up the fluent chain (.update(...).in('id', X)...) to the id scope.
    let node = update
    let idArg = null
    while (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.parent && ts.isCallExpression(node.parent.parent)) {
      const call = node.parent.parent
      if (node.parent.name.text === 'in' && call.arguments[0] && ts.isStringLiteralLike(call.arguments[0]) && call.arguments[0].text === 'id') {
        idArg = call.arguments[1]
      }
      node = call
    }
    if (!idArg || !referencesAny(idArg, derived)) {
      problems.push(
        `${rel}:${line(sf, update)}: bulk approve writes ids that did not come out of ${guard}(...) — a video row in the selection would be stamped approved (R4).`,
      )
    }
  }
}

/** R6: does this file hold a direct video-post endpoint? Returns the first hit's line, or null. */
function videoPostSignature(sf) {
  let hit = null
  walk(sf, (node) => {
    if (hit) return
    let text = null
    if (ts.isStringLiteralLike(node)) text = node.text
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text
    if (text != null && (VIDEO_POST_EXACT.has(text) || VIDEO_POST_PARTS.some((part) => text.includes(part)))) {
      hit = { line: line(sf, node), what: text.length > 60 ? `${text.slice(0, 60)}...` : text }
      return
    }
    // youtube.videos.insert(...)
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'insert' &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === 'videos'
    ) {
      hit = { line: line(sf, node), what: 'videos.insert(...)' }
    }
  })
  return hit
}

/** R7: platform video functions this file imports or re-exports, as `module.fn`. */
function importedPlatformVideoFunctions(sf, rel) {
  const out = []
  walk(sf, (node) => {
    let spec = null
    let names = []
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      spec = node.moduleSpecifier.text
      const bindings = node.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) names = bindings.elements.map((el) => (el.propertyName ?? el.name).text)
      if (bindings && ts.isNamespaceImport(bindings)) names = ['*']
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      spec = node.moduleSpecifier.text
      names =
        node.exportClause && ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements.map((el) => (el.propertyName ?? el.name).text)
          : ['*']
    }
    if (spec == null) return
    const target = resolveSpecifier(rel, spec)
    const fns = target ? PLATFORM_VIDEO_FUNCTIONS.get(target) : null
    if (!fns) return
    for (const name of names) {
      if (name === '*' || fns.includes(name)) out.push(`${target}.${name}`)
    }
  })
  return out
}

/**
 * Run every rule against `read(rel) -> source | null`. `files` is the repo's
 * file list for the whole-tree rules (R6, R7); without it those are skipped.
 * Returns the problems found.
 */
export function checkVideoFreeze(read, files = null) {
  const problems = []

  // R5: the retired May rollout scripts stay deleted.
  for (const rel of RETIRED_SCRIPTS) {
    if (read(rel) != null) {
      problems.push(
        `${rel}: is back. It posted Reels straight to the Graph API around every gate and was deleted for the video freeze (R5).`,
      )
    }
  }

  // R6, R7: no new door around the freeze.
  if (files) {
    for (const rel of files) {
      if (!isScannedCode(rel)) continue
      const src = read(rel)
      if (src == null) continue
      const wantsR6 = !VIDEO_POST_ALLOWED.has(rel) && R6_HINTS.some((h) => src.includes(h))
      const wantsR7 = rel !== PUBLISH_ROUTE && R7_HINTS.some((h) => src.includes(h))
      if (!wantsR6 && !wantsR7) continue
      const sf = parse(rel, src)
      if (wantsR6) {
        const hit = videoPostSignature(sf)
        if (hit) {
          problems.push(
            `${rel}:${hit.line}: posts video to a platform directly (\`${hit.what}\`) outside a guarded choke point. Route it through /api/social/publish, or guard it with lib/content/video-freeze.ts and add it to CHOKE_POINTS (R6).`,
          )
        }
      }
      if (wantsR7) {
        for (const fn of importedPlatformVideoFunctions(sf, rel)) {
          problems.push(`${rel}: imports ${fn}, a platform video function only ${PUBLISH_ROUTE} may call (it refuses video) (R7).`)
        }
      }
    }
  }

  // R0 — the guard module.
  const guardSrc = read(GUARD_MODULE)
  if (guardSrc == null) {
    problems.push(`${GUARD_MODULE}: missing. The video freeze has no guard (R0).`)
  } else {
    const sf = parse(GUARD_MODULE, guardSrc)
    let frozenFlag = null
    const exported = new Set()
    let message = null
    for (const stmt of sf.statements) {
      const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (!isExported) continue
      if (ts.isFunctionDeclaration(stmt) && stmt.name) exported.add(stmt.name.text)
      if (ts.isVariableStatement(stmt)) {
        for (const d of stmt.declarationList.declarations) {
          if (!ts.isIdentifier(d.name)) continue
          exported.add(d.name.text)
          if (d.name.text === 'VIDEO_PUBLISH_FROZEN') frozenFlag = d.initializer
          if (d.name.text === 'VIDEO_FREEZE_MESSAGE' && d.initializer && ts.isStringLiteralLike(d.initializer)) message = d.initializer.text
        }
      }
    }
    if (!frozenFlag || frozenFlag.kind !== ts.SyntaxKind.TrueKeyword) {
      problems.push(`${GUARD_MODULE}: VIDEO_PUBLISH_FROZEN must be exported and initialised to the literal \`true\` until the certificate check replaces the freeze (R0).`)
    }
    for (const name of GUARD_EXPORTS) {
      if (!exported.has(name)) problems.push(`${GUARD_MODULE}: does not export \`${name}\` (R0).`)
    }
    if (message !== FREEZE_MESSAGE) {
      problems.push(`${GUARD_MODULE}: VIDEO_FREEZE_MESSAGE is not Matt's wording: "${FREEZE_MESSAGE}" (R0).`)
    }
  }

  for (const point of CHOKE_POINTS) {
    const rel = point.file
    const src = read(rel)
    if (src == null) {
      problems.push(`${rel}: missing. Choke point "${point.what}" is gone; if it moved, move its guard and update CHOKE_POINTS.`)
      continue
    }
    const sf = parse(rel, src)

    const scopeName = point.scope ?? 'the module'

    // R1
    if (!guardImports(sf, rel).has(point.guard)) {
      problems.push(`${rel}: does not import \`${point.guard}\` from '${GUARD_SPECIFIER}' (R1, ${point.what}).`)
      continue
    }
    if (declaresLocally(sf, point.guard)) {
      problems.push(`${rel}: declares its own \`${point.guard}\`, shadowing the real guard (R1, ${point.what}).`)
      continue
    }

    const scope = findScope(sf, point.scope)
    if (!scope) {
      problems.push(`${rel}: no function \`${point.scope}\`. Choke point "${point.what}" moved; move its guard and update CHOKE_POINTS.`)
      continue
    }

    if (point.bulkIds) {
      checkBulkIds(sf, scope, point.guard, rel, problems)
      continue
    }

    // R2
    const writes = writeCalls(scope, point.writes, sf)
    if (writes.length === 0) {
      problems.push(`${rel}: \`${scopeName}\` has no guarded write to check (${JSON.stringify(point.writes, (k, v) => (v instanceof RegExp ? String(v) : v))}). It moved; update CHOKE_POINTS.`)
      continue
    }
    const ifs = guardIfs(scope, point.guard)
    if (ifs.length === 0) {
      problems.push(`${rel}: \`${scopeName}\` never refuses on \`${point.guard}(...)\` (no if that tests it and returns/continues/throws) (R2, ${point.what}).`)
      continue
    }
    for (const write of writes) {
      if (!ifs.some((ifStmt) => dominates(ifStmt, write))) {
        problems.push(
          `${rel}:${line(sf, write)}: \`${write.expression.getText(sf).replace(/\s+/g, '').slice(-70)}(...)\` can run without the \`${point.guard}\` refusal before it (R2, ${point.what}).`,
        )
      }
    }

    // R3
    if (point.status423) {
      const answers423 = ifs.some((ifStmt) => {
        let found = false
        walk(ifStmt.thenStatement, (n) => {
          if (
            !found &&
            ts.isPropertyAssignment(n) &&
            ts.isIdentifier(n.name) &&
            n.name.text === 'status' &&
            ts.isNumericLiteral(n.initializer) &&
            n.initializer.text === '423'
          ) {
            found = true
          }
        })
        return found
      })
      if (!answers423) problems.push(`${rel}: the video refusal does not answer 423 Locked (R3).`)
    }
  }

  return problems
}

export function readFromDisk(root) {
  return (rel) => {
    const p = join(root, rel)
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  }
}

/** Tracked files plus untracked-but-not-ignored ones: what a commit could carry. */
export function listRepoFiles(root) {
  const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  if (r.status !== 0) throw new Error(`file listing failed in ${root}: ${(r.stderr || '').trim()}`)
  return [...new Set(r.stdout.split('\0').filter(Boolean))].filter((rel) => existsSync(join(root, rel)))
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const REPORT = process.argv.includes('--report')
  const JSON_OUT = process.argv.includes('--json')
  const problems = checkVideoFreeze(readFromDisk(process.cwd()), listRepoFiles(process.cwd()))
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: problems.length === 0, chokePoints: CHOKE_POINTS.length, problems }, null, 2))
    process.exit(problems.length && !REPORT ? 1 : 0)
  }
  if (problems.length) {
    console.error(`ci:video-freeze FAILED: the video freeze (Matt 2026-10-14) is not wired at every choke point:`)
    for (const p of problems) console.error(`  ✗ ${p}`)
    process.exit(REPORT ? 0 : 1)
  }
  console.log(
    `✓ ci:video-freeze passed: ${CHOKE_POINTS.length} choke points refuse video before they write; no direct video-post door outside them (lib/content/video-freeze.ts).`,
  )
}
