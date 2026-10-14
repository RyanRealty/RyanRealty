/**
 * Content-queue gate: the rules every social draft in content-queue/ must pass
 * before it can merge or publish. Pure functions, no network. Used by
 * scripts/content-queue/check.mjs (CI) and publish.mjs (refuses anything that fails).
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const PLATFORMS = {
  gbp: { utmSource: 'gbp', maxChars: 1500 },
  'linkedin-personal': { utmSource: 'linkedin', maxChars: 3000 },
  'linkedin-company': { utmSource: 'linkedin', maxChars: 3000 },
  'x-post': { utmSource: 'x', maxChars: 280 },
  'x-article': { utmSource: 'x', maxChars: 100000 },
}

export const BROKERAGE = 'Ryan Realty LLC'
export const MAX_OVERLAP = 0.3

/** Proper nouns that may appear even when the source article does not use them. */
export const NAME_ALLOWLIST = [
  'Ryan Realty', 'Ryan Realty LLC', 'Central Oregon', 'Deschutes County', 'Crook County', 'Jefferson County',
  'Oregon Real Estate Agency', 'Learn More', 'Read More', 'Full Guide', 'New Construction', 'La Pine',
]

const GUARANTEE = [
  /\bguarantee[sd]?\b/i, /\bguaranteeing\b/i, /\bpromise[sd]?\b/i, /\brisk[- ]free\b/i, /\bsure thing\b/i,
  /\bcan(?:no|')t lose\b/i, /\bwill sell (?:fast|quickly|in)\b/i, /\bsold in \d+ days or\b/i, /\b#1\b/,
  /\bnumber one (?:agent|brokerage|team)\b/i, /\btop team\b/i, /\bbest agent\b/i, /\bno risk\b/i,
]

export function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) return { data: null, body: text }
  const data = {}
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line)
    if (!kv) continue
    let v = kv[2].trim()
    if (/^".*"$/.test(v)) v = JSON.parse(v)
    else if (v === 'true' || v === 'false') v = v === 'true'
    data[kv[1]] = v
  }
  return { data, body: m[2].trim() }
}

export function platformKey(platform) {
  return platform.startsWith('x-post') ? 'x-post' : platform
}

/** X counts every URL as 23 characters. */
export function platformLength(platform, body) {
  if (platformKey(platform) === 'x-post') return body.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length
  return [...body].length
}

const norm = (s) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9$%.' ]+/g, ' ')
const words = (s) => norm(s).split(/\s+/).filter(Boolean)

/** Fraction of the draft's 5-word shingles that also appear in the source. */
export function overlapRatio(draft, source) {
  const shingles = (w) => { const out = new Set(); for (let i = 0; i + 5 <= w.length; i++) out.add(w.slice(i, i + 5).join(' ')); return out }
  const d = shingles(words(draft.replace(/https?:\/\/\S+/g, '')))
  if (d.size === 0) return 0
  const s = shingles(words(source))
  let hit = 0
  for (const x of d) if (s.has(x)) hit++
  return hit / d.size
}

/** Numbers in the draft, normalized (no $ , or trailing %), ignoring URLs. */
export function extractNumbers(text) {
  // Ordered-list markers ("2. ") are structure, not figures.
  const clean = text.replace(/https?:\/\/\S+/g, ' ').replace(/^\s*\d+\.\s/gm, ' ')
  return [...clean.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, '').replace(/\.0+$/, '')).filter((n) => n !== '')
}

export function numberTraceable(n, sourceNumbers) {
  return sourceNumbers.has(n)
}

/** Capitalized multi-word runs (likely person names) that are not in the source or allowlist. */
export function untracedNames(body, source) {
  const clean = body.replace(/https?:\/\/\S+/g, ' ')
  const runs = [...clean.matchAll(/\b([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)+)\b/g)].map((m) => m[1])
  const src = source.toLowerCase()
  return runs.filter((r) => {
    if (NAME_ALLOWLIST.some((a) => a.toLowerCase() === r.toLowerCase())) return false
    if (src.includes(r.toLowerCase())) return false
    // A sentence-initial word followed by a sourced proper noun ("Selling Bend") is fine.
    const tail = r.split(/\s+/).slice(1).join(' ')
    if (tail && (src.includes(tail.toLowerCase()) || NAME_ALLOWLIST.some((a) => a.toLowerCase() === tail.toLowerCase()))) return false
    return true
  })
}

export function checkUtm(link, platform, slug) {
  const errs = []
  let u
  try { u = new URL(link) } catch { return [`link is not a valid URL: ${link}`] }
  const p = u.searchParams
  const want = PLATFORMS[platformKey(platform)]?.utmSource
  if (p.get('utm_source') !== want) errs.push(`utm_source must be ${want}, got ${p.get('utm_source')}`)
  if (p.get('utm_medium') !== 'social') errs.push(`utm_medium must be social, got ${p.get('utm_medium')}`)
  if (p.get('utm_campaign') !== slug) errs.push(`utm_campaign must be ${slug}, got ${p.get('utm_campaign')}`)
  if (u.hostname !== 'ryan-realty.com') errs.push(`link host must be ryan-realty.com, got ${u.hostname}`)
  return errs
}

/**
 * Check one draft. Returns a list of failure strings (empty = pass).
 * `extraNames` is an optional list of known client names (lowercase) loaded at publish time.
 */
export function checkDraft({ text, platform, slug, sourceText, extraNames = [] }) {
  const errs = []
  const { data, body } = parseFrontmatter(text)
  if (!data) return ['missing frontmatter']
  const key = platformKey(platform)
  if (!PLATFORMS[key]) return [`unknown platform file: ${platform}`]
  for (const f of ['platform', 'source_url', 'link', 'scheduled_at']) if (!data[f]) errs.push(`frontmatter missing ${f}`)
  if (data.platform && data.platform !== key) errs.push(`frontmatter platform ${data.platform} does not match file ${platform}`)
  if (data.scheduled_at && Number.isNaN(Date.parse(data.scheduled_at))) errs.push(`scheduled_at is not a date: ${data.scheduled_at}`)
  if (data.source_url && data.source_url !== `https://ryan-realty.com/blog/${slug}`) errs.push(`source_url must be https://ryan-realty.com/blog/${slug}`)
  if (data.link) {
    errs.push(...checkUtm(data.link, platform, slug))
    if (key !== 'x-article' && !body.includes(data.link)) errs.push('body must contain the UTM link exactly')
  }
  for (const m of body.matchAll(/https?:\/\/\S+/g)) {
    if (/ryan-realty\.com/.test(m[0]) && !/utm_source=/.test(m[0])) errs.push(`untagged site link: ${m[0]}`)
  }
  if (!body.includes(BROKERAGE)) errs.push(`missing "${BROKERAGE}"`)
  for (const re of GUARANTEE) { const m = re.exec(body); if (m) errs.push(`guarantee language: "${m[0]}"`) }
  if (/[\u2014\u2013]/.test(body)) errs.push('em or en dash in copy')
  const len = platformLength(platform, body)
  if (len > PLATFORMS[key].maxChars) errs.push(`length ${len} exceeds ${key} limit ${PLATFORMS[key].maxChars}`)
  const srcNums = new Set(extractNumbers(sourceText))
  for (const n of new Set(extractNumbers(body))) if (!numberTraceable(n, srcNums)) errs.push(`number not in source article: ${n}`)
  const ov = overlapRatio(body, sourceText)
  if (ov > MAX_OVERLAP) errs.push(`overlaps source by ${(ov * 100).toFixed(0)}% (max ${MAX_OVERLAP * 100}%)`)
  for (const n of untracedNames(body, sourceText)) errs.push(`possible person name not in source: "${n}"`)
  const lower = body.toLowerCase()
  for (const n of extraNames) if (n && lower.includes(n)) errs.push('client name from CRM appears in copy')
  return errs
}

/** Every draft under a queue root: [{ slug, platform, file }]. */
export function listDrafts(root) {
  if (!existsSync(root)) return []
  const out = []
  for (const slug of readdirSync(root)) {
    const dir = join(root, slug)
    if (slug.startsWith('.') || slug.startsWith('_') || !statSync(dir).isDirectory()) continue
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f === 'source.md' || f.endsWith('.paste.md')) continue
      out.push({ slug, platform: f.replace(/\.md$/, ''), file: join(dir, f) })
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file))
}

export function readSource(root, slug) {
  const p = join(root, slug, 'source.md')
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}
