#!/usr/bin/env node
/**
 * check-private-phone.mjs — ci:private-phone.
 *
 * 541.213.6706 is NOT a public number. It is the pre-2026-07-02 line, demoted
 * by the Twilio cutover to a private forward target (see lib/brand/contact.ts).
 * The public number is CONTACT.phoneDirect, 541.703.3095.
 *
 * On 2026-08-06 the old number was still published in three places a client
 * could reach: the golf landing page rendered "Call 541.213.6706" with a live
 * tel: link, the Tetherow broker block carried it as phone + phone_tel, and the
 * tokenized e-signing page told signers to call it. Each was a hand-typed
 * literal that could not follow a port, and none of them tripped
 * ci:broker-published-phone, which polices personal cells in generated
 * documents rather than hardcoded numbers in source.
 *
 * The rule: a phone number reaching a reader comes from lib/brand/contact.ts.
 * Nobody types one into a page, a component, a content registry, or a scene
 * builder.
 *
 * Comments are stripped before scanning, because the number legitimately
 * appears in prose explaining this very history.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// Matched as a phone number, with the separators a phone number actually uses.
// A first cut stripped every non-digit from the whole file and looked for the
// 10-digit run, which spliced digits across unrelated lines and reported four
// files that never contained the number. Bounded pattern, or the gate cries
// wolf and gets ignored.
const PRIVATE_NUMBERS = [
  {
    re: /\+?1?[\s.\-(]*541[\s.\-)]*213[\s.\-]*6706/,
    label: '541.213.6706 (private forward target since the 2026-07-02 Twilio cutover)',
  },
]

/**
 * Places the number belongs. Each of these USES the old line as the forward
 * target it still is, rather than publishing it as the way to reach us.
 */
const ALLOWED = new Set([
  'lib/brand/contact.ts',
  'scripts/check-private-phone.mjs',
  // Historical inventory of assets removed on 2026-06-09. A record of what an
  // old graphic showed is not a publication of the number.
  'data/asset-library/deletions-2026-06-09.json',
  // The §0 tracer's registry of OUR numbers, so the broker SMS agent does not
  // flag a brand phone as an untraced figure. It must list the old line to
  // recognize it.
  'lib/agent/trace.ts',
  // The CRM fallback forward target genuinely IS this number. That is what a
  // forward target is for.
  'lib/data/crm/getCrmCompanySettings.ts',
])

/**
 * Admin and CRM-internal screens are excluded. VOICE.md does not govern them
 * and no lead reads them; the two hits there are a validation-error example and
 * a form placeholder, both showing a broker the format of the forward number
 * they are editing. The concern is publication to the public, not mention.
 */
const ADMIN = /^(app\/admin\/|components\/admin\/|app\/actions\/crm-|app\/dashboard\/marketing\/)/

const SCAN = ['app', 'components', 'data', 'lib']

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
}

const files = execSync(
  `git ls-files ${SCAN.join(' ')}`,
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
)
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|json|md)$/.test(f))
  .filter((f) => !ALLOWED.has(f))
  .filter((f) => !ADMIN.test(f))
  .filter((f) => !/\.test\./.test(f))

const hits = []
for (const file of files) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const body = file.endsWith('.json') ? src : stripComments(src)
  const lines = body.split('\n')
  for (const { re, label } of PRIVATE_NUMBERS) {
    lines.forEach((text, i) => {
      if (re.test(text)) hits.push({ file, line: i + 1, label })
    })
  }
}

if (hits.length > 0) {
  console.error('\n✖ A private phone number is published in source.\n')
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}`)
    console.error(`    ${h.label}`)
  }
  console.error(
    '\n  Import it instead:  import { CONTACT } from \'@/lib/brand/contact\'  →  CONTACT.phoneDirect' +
      '\n  A number typed into a file cannot follow the next port.\n'
  )
  process.exit(1)
}

console.log(`✓ ci:private-phone: no demoted number published across ${files.length} file(s).`)
