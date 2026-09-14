/**
 * About lock (Matt 2026-09-12, restated 2026-09-14).
 *
 * Tip Ready cannot be a checkbox. A lone `competitiveBriefPass: true` is
 * refuse. Each Researchy beat needs a quote that actually appears in the
 * About source, and the source itself must carry the locked tokens
 * (boutique / Central Oregon / buy and sell; no broker roster; reviews +
 * closings; Call|Text|Email|Schedule; 115 NW Oregon Ave #2 + OREA).
 *
 * Used by ci:page-purpose, taste-receipt --ship / --about-lock, and
 * site-queue-done. Do not invent true.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function isNonEmptyString(v, min = 1) {
  return typeof v === 'string' && v.trim().length >= min
}

export const ABOUT_LOCK_ID = 'about-matt-2026-09-12'

/** Files the About lock reads. Missing file = fail that beat, not a skip. */
export const ABOUT_LOCK_FILES = Object.freeze([
  'app/about/page.tsx',
  'app/about/_v3/AboutFirm.tsx',
  'app/about/_v3/AboutOffice.tsx',
  'app/about/_v3/AboutInquiry.tsx',
  'app/about/_v3/FirmClosings.tsx',
  'app/about/_v3/about-constants.ts',
  'app/about/_v3/about-fold.css',
  'lib/brand/contact.ts',
  'components/site/v3/V3Carousel.client.tsx',
  'components/site/v3/V3Input.tsx',
])

/**
 * Locked beats. `tokens` must appear in the evidence quote. `sourceRequire`
 * / `sourceForbid` run against the concatenated About source (anti-cheat).
 */
export const ABOUT_LOCK_BEATS = Object.freeze([
  {
    id: '1',
    text: 'Firm story opens the page: small boutique brokerage, all of Central Oregon, help clients buy and sell. Not a staff-directory fold.',
    tokens: [/boutique/i, /Central Oregon/, /buy and sell/],
    sourceRequire: [/<AboutFirm\b/, /ABOUT_FIRM_STORY/, /boutique/, /Central Oregon/, /buy and sell/],
  },
  {
    id: '2',
    text: 'Brokers are not on About. No broker Cards, roster dump, Meet-the-Team band, or AboutTeamTeaser. Brokers belong on /team only.',
    tokens: [/\/team/],
    sourceRequire: [/\/team/],
    sourceForbid: [/<AboutFaces\b/, /<AboutTeamTeaser\b/, /AvatarGroup/, /Meet the team/],
  },
  {
    id: '3',
    text: 'Firm reviews as words (V3Proof) plus dated local closings as a carousel of recorded sales. Never invent MOS.',
    tokens: [/V3Proof|reviews/i, /closings|carousel/i],
    sourceRequire: [/<V3Proof\b/, /<FirmClosings\b/, /V3Carousel/, /mode="rail"/],
    sourceForbid: [/months of supply/i],
  },
  {
    id: '4',
    text: 'Four-up reach on one control: Call, Text, Email, Schedule. Call is primary and carries live hours.',
    tokens: [/\bCall\b/, /\bText\b/, /\bEmail\b/, /\bSchedule\b/],
    sourceRequire: [
      /kicker: v3Text\('Call'\)/,
      /kicker: v3Text\('Text'\)/,
      /kicker: v3Text\('Email'\)/,
      /kicker: v3Text\('Schedule'\)/,
      /primary: true/,
      /<V3OnDuty\b/,
    ],
  },
  {
    id: '5',
    text: 'Office 115 NW Oregon Ave #2 is on the page. Optional exterior hero of that office.',
    tokens: [/115 NW Oregon Ave #2/],
    sourceRequire: [/115 NW Oregon Ave #2/, /BRAND\.address\.street/, /ryan-realty-bend-office-exterior/],
    sourceForbid: [/ryan-realty-bend-office-interior/],
  },
  {
    id: '6',
    text: 'Firm OREA license is on the page. One-line inquiry GET-submits to /contact.',
    tokens: [/OREA/, /\/contact/],
    sourceRequire: [/FIRM_LICENSE/, /OREA/, /action="\/contact"/, /method="get"/],
  },
  {
    id: '7',
    text: 'Navy and cream only. Redfin is the layout and interaction reference, not a second palette.',
    tokens: [/navy/i, /cream/i],
    sourceRequire: [/Navy and cream only/, /--v3-/],
    sourceForbid: [/about-fold[\s\S]{0,80}#[0-9a-fA-F]{6}/],
  },
  {
    id: '8',
    text: 'Catalog interactions are real: closings carousel (shadcn carousel + Card) and inquiry input. Avatar-import plus cream CSS is not a demo match.',
    tokens: [/carousel/i, /Card|input/i],
    sourceRequire: [
      /from '@\/components\/ui\/carousel'/,
      /from '@\/components\/ui\/card'/,
      /from '@\/components\/ui\/input'|from '@\/components\/motion\/input'/,
    ],
  },
])

export function isAboutLockBrief(brief, kit) {
  if (kit === 'about') return true
  const id = isPlainObject(brief) ? String(brief.id ?? '') : ''
  return id === ABOUT_LOCK_ID || id === 'about-researchy-1-8'
}

export function readAboutLockSource(root = process.cwd(), files = ABOUT_LOCK_FILES) {
  const parts = []
  const missing = []
  for (const rel of files) {
    const abs = join(root, rel)
    if (!existsSync(abs)) {
      missing.push(rel)
      continue
    }
    parts.push(readFileSync(abs, 'utf8'))
  }
  return { source: parts.join('\n'), missing }
}

function sourceHits(source, re) {
  return re.test(source)
}

/**
 * Mechanical About source check. A page that reintroduces a roster or drops
 * the firm story fails here even if someone flipped competitiveBriefPass.
 */
export function aboutLockSourceProblems({ root = process.cwd(), sourceText, files } = {}) {
  const read = sourceText != null ? { source: String(sourceText), missing: [] } : readAboutLockSource(root, files)
  const p = []
  for (const rel of read.missing) {
    p.push(`About lock missing ${rel}. The page cannot pass a beat it deleted.`)
  }
  const src = read.source
  for (const beat of ABOUT_LOCK_BEATS) {
    for (const re of beat.sourceRequire ?? []) {
      if (!sourceHits(src, re)) {
        p.push(`About lock beat ${beat.id} missing /${re.source}/ — ${beat.text.slice(0, 80)}`)
      }
    }
    for (const re of beat.sourceForbid ?? []) {
      if (sourceHits(src, re)) {
        p.push(`About lock beat ${beat.id} reintroduced /${re.source}/ — ${beat.text.slice(0, 80)}`)
      }
    }
  }
  return p
}

function quoteInSource(quote, source) {
  const q = String(quote ?? '').replace(/\s+/g, ' ').trim()
  if (q.length < 24) return false
  const hay = String(source ?? '').replace(/\s+/g, ' ')
  return hay.includes(q)
}

/**
 * Anti-cheat for Tip Ready. A lone boolean / all-true checklist is refuse.
 * Each beat needs a 24+ character quote that (1) matches that beat's tokens
 * and (2) appears in the About source. Invented quotes fail.
 */
export function competitiveBriefEvidenceProblems(tr, brief, { root = process.cwd(), sourceText } = {}) {
  if (!isPlainObject(brief) || !Array.isArray(brief.beats) || brief.beats.length === 0) {
    return ['competitiveBrief is required to score About evidence.']
  }
  if (!isPlainObject(tr)) return ['tasteReview is required. A lone boolean is refuse.']

  const evidence = tr.competitiveBriefEvidence
  if (!isPlainObject(evidence)) {
    return [
      'competitiveBriefEvidence is required on About. A lone competitiveBriefPass boolean / checkbox is refuse.',
    ]
  }

  const read = sourceText != null ? { source: String(sourceText), missing: [] } : readAboutLockSource(root)
  const p = []
  const beats = ABOUT_LOCK_BEATS
  for (const beat of beats) {
    const quote = evidence[beat.id]
    if (!isNonEmptyString(quote, 24)) {
      p.push(`competitiveBriefEvidence.${beat.id} must be a 24+ character quote from the About source.`)
      continue
    }
    const missed = (beat.tokens ?? []).filter((re) => !re.test(String(quote)))
    if (missed.length) {
      p.push(
        `competitiveBriefEvidence.${beat.id} is missing token /${missed[0].source}/. Boolean checkbox pass is refuse.`,
      )
    }
    if (!quoteInSource(quote, read.source)) {
      p.push(
        `competitiveBriefEvidence.${beat.id} is not in the About source. Invented quotes fail. Boolean checkbox pass is refuse.`,
      )
    }
  }
  const extraNeeded = brief.beats.filter((b) => b && !beats.some((lock) => lock.id === String(b.id)))
  for (const b of extraNeeded) {
    const quote = evidence[String(b.id)]
    if (!isNonEmptyString(quote, 24)) {
      p.push(`competitiveBriefEvidence.${b.id} must be a 24+ character quote from the About source.`)
    }
  }
  return p
}

export function aboutRequiredComponentProblems(kit, parsed) {
  if (kit !== 'about') return []
  const list = Array.isArray(parsed?.requiredComponents) ? parsed.requiredComponents : []
  if (list.length === 0) return []
  const names = list
    .map((c) => (typeof c === 'string' ? c : isPlainObject(c) ? String(c.name ?? '') : ''))
    .map((s) => s.trim())
    .filter(Boolean)
  const p = []
  if (names.includes('AboutFaces')) {
    p.push('About requiredComponents cannot include AboutFaces. Brokers belong on /team.')
  }
  if (names.includes('AboutTeamTeaser')) {
    p.push('About requiredComponents cannot include AboutTeamTeaser. Brokers belong on /team. No Meet-the-Team dump.')
  }
  if (!names.includes('AboutFirm')) {
    p.push('About requiredComponents must include AboutFirm (firm story opener).')
  }
  if (!names.includes('AboutOffice')) {
    p.push('About requiredComponents must include AboutOffice (115 NW Oregon Ave #2 + firm OREA).')
  }
  return p
}

/**
 * Tip Ready extras for About: evidence quotes + live source lock.
 * Call only when the receipt already claims competitiveBriefPass true.
 */
export function aboutTipReadyProblems(tr, brief, { root = process.cwd(), sourceText, kit } = {}) {
  if (!isAboutLockBrief(brief, kit)) return []
  return [
    ...competitiveBriefEvidenceProblems(tr, brief, { root, sourceText }),
    ...aboutLockSourceProblems({ root, sourceText }),
  ]
}
