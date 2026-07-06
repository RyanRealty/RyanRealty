// Temp helper (gitignored convention `_`): scan assembled SEO prose against the
// canonical brand-voice vocabulary BEFORE wiring it into lib/community-seo-content.ts.
// Usage: node scripts/_seo-prose-scan.mjs out/community-seo-batch.json
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const vocab = require('./brand-voice-vocabulary.cjs')

const file = process.argv[2]
if (!file) { console.error('pass a JSON file: { entries: [{slug, heading, paragraphs[], sources[]}] }'); process.exit(2) }
const data = JSON.parse(readFileSync(file, 'utf8'))
const entries = Array.isArray(data) ? data : (data.entries ?? [])

let totalFails = 0
for (const e of entries) {
  const text = (e.paragraphs ?? []).join('\n')
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const fails = []
  // Punctuation hard fails
  for (const p of vocab.PUNCTUATION) {
    // exclamation handled as body-prose ban; em/en/semicolon always
    const idx = text.indexOf(p.char)
    if (idx !== -1) fails.push(`PUNCT ${p.label}: ...${text.slice(Math.max(0,idx-25), idx+25).replace(/\n/g,' ')}...`)
  }
  // Banned words (whole-word, case-insensitive)
  const lower = text.toLowerCase()
  for (const w of vocab.BANNED_WORD_STRINGS) {
    const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i')
    if (re.test(lower)) fails.push(`WORD "${w}"`)
  }
  // Banned patterns (VOICE.md laws)
  for (const pat of vocab.BANNED_PATTERNS) {
    const re = new RegExp(pat.source, 'i')
    const m = text.match(re)
    if (m) fails.push(`PATTERN law${pat.law} ${pat.label}: "${m[0]}"`)
  }
  const status = fails.length === 0 ? 'CLEAN' : `${fails.length} FAIL`
  console.log(`\n[${e.slug}] ${words} words · ${(e.paragraphs??[]).length} paras · ${(e.sources??[]).length} sources · ${status}`)
  for (const f of fails) console.log(`   ✗ ${f}`)
  totalFails += fails.length
}
console.log(`\n=== ${entries.length} entries, ${totalFails} total violations ===`)
process.exit(totalFails === 0 ? 0 : 1)
