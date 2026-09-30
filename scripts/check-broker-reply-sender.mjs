#!/usr/bin/env node
/**
 * check-broker-reply-sender.mjs — a send that replies to one of our mailboxes
 * must say who it is from.
 *
 * Why this is a gate: sendEmail with no `from` goes out as the bare
 * RESEND_FROM (Ryan Realty <noreply@mail.ryan-realty.com>). Paired with a
 * Reply-To of a broker mailbox, Gmail filed it as spam. Measured against
 * matt@ryan-realty.com on 2026-09-30: every signing invite and reminder since
 * 09-29 sat in spam while Resend reported "delivered"; the same invite sent as
 * "Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com> landed in the inbox.
 * The fix is brokerSendIdentity (lib/email/broker-identity.ts), which sets the
 * From and the Reply-To together. Tests: lib/tc/signing-emails.test.ts.
 *
 * Rule: a `sendEmail({ ... })` call whose replyTo names one of our mailboxes
 * (a literal @ryan-realty.com address, or an expression about a broker, the
 * signed-in user, or an envelope's creator) must also pass `from`. A Reply-To
 * of the lead (an internal alert to a broker) is the shape that delivers and
 * is not flagged.
 *
 * Usage: node scripts/check-broker-reply-sender.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'tmp', 'out'])
const OUR_MAILBOX = /ryan-realty\.com|broker|auth\.email|created_?by|sender/i

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* sourceFiles(path)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path
  }
}

/** Each `sendEmail({ ... })` object literal in the file, with its line. */
function sendCalls(source) {
  const calls = []
  let at = 0
  while ((at = source.indexOf('sendEmail({', at)) >= 0) {
    let depth = 0
    let end = at + 'sendEmail('.length
    for (; end < source.length; end++) {
      if (source[end] === '{') depth++
      else if (source[end] === '}' && --depth === 0) break
    }
    calls.push({ line: source.slice(0, at).split('\n').length, body: source.slice(at, end + 1) })
    at = end
  }
  return calls
}

const violations = []
for (const top of ['app', 'lib']) {
  for (const file of sourceFiles(join(ROOT, top))) {
    for (const { line, body } of sendCalls(readFileSync(file, 'utf8'))) {
      const reply = body.match(/\breplyTo\s*:\s*([^,\n]+(?:\n\s+[^,\n]+)?)/)
      if (!reply) continue
      if (/\bfrom\s*:/.test(body)) continue
      if (!OUR_MAILBOX.test(reply[1])) continue
      violations.push(`${relative(ROOT, file)}:${line}  replyTo: ${reply[1].trim()}`)
    }
  }
}

if (violations.length) {
  console.error('ci:broker-reply-sender FAILED: these sends reply to our mailbox but have no From.')
  console.error('They go out as bare noreply@ with a broker Reply-To, which Gmail files as spam.')
  console.error('Use brokerSendIdentity(broker) from lib/email/broker-identity.ts for both from and replyTo.\n')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}
console.log('ci:broker-reply-sender OK: every send that replies to our mailbox names its sender')
