/**
 * About lock (Matt 2026-09-21 SITE-163, restated from 2026-09-12/14).
 *
 * Faces open the page at display scale. Firm story stays one boutique
 * sentence. 5.0 from 25 and 115 NW Oregon Ave #2 stay. Deep bios stay on
 * /team. No Meet-the-Team dump, no three equal broker Cards, no KPI grid.
 *
 * Beat 9 (Matt 2026-09-23, the About-page AEO playbook): below the proof the
 * page carries What Ryan Realty does, What makes Ryan Realty different, Who
 * Ryan Realty works with, How Ryan Realty works (the same business day
 * promise), The team behind Ryan Realty, Key facts about Ryan Realty (one
 * <dl>) and Frequently asked questions (H3 questions, FAQPage from the same
 * array). No competitor is named anywhere in the About copy (NAR Code Article
 * 15, Oregon advertising rules), and the key facts carry no Notable clients,
 * Competitors or Contract terms row.
 *
 * Tip Ready cannot be a checkbox. A lone `competitiveBriefPass: true` is
 * refuse. Each Researchy beat needs a quote that actually appears in the
 * About source.
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

export const ABOUT_LOCK_ID = 'about-matt-2026-09-21'

/** Files the About lock reads. Missing file = fail that beat, not a skip. */
export const ABOUT_LOCK_FILES = Object.freeze([
  'app/about/page.tsx',
  'app/about/_v3/AboutFirm.tsx',
  'app/about/_v3/AboutFirmFaces.client.tsx',
  'app/about/_v3/AboutOffice.tsx',
  'app/about/_v3/AboutInquiry.tsx',
  'app/about/_v3/AboutReach.tsx',
  'app/about/_v3/FirmClosings.tsx',
  'app/about/_v3/about-constants.ts',
  'app/about/_v3/about-fold.css',
  'components/site/v3/V3Avatar.tsx',
  'lib/brand/contact.ts',
  'app/about/_v3/about-playbook.ts',
])

/**
 * The files that hold About VISITOR COPY. `copyForbid` runs against these
 * only, because the design comments in the stylesheet and the provenance notes
 * in lib/brand name third-party sites for reasons that are not public copy.
 */
export const ABOUT_COPY_FILES = Object.freeze([
  'app/about/page.tsx',
  'app/about/_v3/about-constants.ts',
  'app/about/_v3/about-playbook.ts',
])

/** Brokerages and portals the About copy may not name (Matt 2026-09-23). */
export const ABOUT_COMPETITOR_RE =
  /\b(Compass|Redfin|Zillow|Coldwell Banker|Keller Williams|RE\/MAX|Sotheby'?s|Berkshire Hathaway|Windermere|eXp Realty|Cascade Hasson|Duke Warner|Fred Real Estate|Century 21|Opendoor|Realty ONE)\b/

/**
 * Locked beats. `tokens` must appear in the evidence quote. `sourceRequire`
 * / `sourceForbid` run against the concatenated About source (anti-cheat).
 */
export const ABOUT_LOCK_BEATS = Object.freeze([
  {
    id: '1',
    text: 'Faces open the page at display scale, with one boutique Central Oregon buy-and-sell sentence. Not a storefront postcard. Not a KPI grid. Not a staff-directory fold.',
    tokens: [/boutique/i, /Central Oregon/, /buy and sell/],
    sourceRequire: [
      /<AboutFirm\b/,
      /ABOUT_FIRM_STORY/,
      /boutique/,
      /Central Oregon/,
      /buy and sell/,
      /about-firm__faces/,
    ],
    sourceForbid: [
      /We are a small boutique brokerage\.\s*We work all of Central Oregon\.\s*We help clients buy and sell/,
      /openingFigures/,
    ],
  },
  {
    id: '2',
    text: 'Faces at display scale (shadcn Avatar). Deep bios stay on /team. No Meet-the-Team dump, no three equal broker Cards, no AboutTeamTeaser.',
    tokens: [/display scale/, /\/team/],
    sourceRequire: [
      /Faces open the page at display scale/,
      /\/team/,
      // Matt 2026-09-23 (AEO-5 / VOICE-5, visibility audit 2026-09-22): the FAQ
      // names the brokers and their roles from the live roster instead of
      // answering with the door "The brokers are on /team". Answer engines
      // quote the FAQPage answer; a URL path is not an answer.
      /aboutBrokersAnswer\(/,
      // 2026-09-23: the call also passes the live office hours for the
      // playbook FAQ (beat 9); the roster is still its first argument.
      /aboutFaqItems\(proof\.faces[,)]/,
      /from '@\/components\/ui\/avatar'/,
      /<AvatarGroup\b/,
      /<AvatarImage\b|<V3Avatar\b/,
      /AvatarFallback/,
      /AvatarBadge/,
    ],
    sourceForbid: [
      /<AboutFaces\b/,
      /<AboutTeamTeaser\b/,
      /Meet the team/,
      /id=["']team-teaser["']/,
      /Who you work with/,
      /about-teaser/,
      /ABOUT_BROKER_ROSTER/,
      /size=["']proof["']/,
      /Who are the brokers\?[\s\S]{0,500}OR #/,
    ],
  },
  {
    id: '3',
    text: 'Firm reviews as words (V3Proof) plus dated local closings as a carousel of recorded sales. Never invent MOS.',
    tokens: [/V3Proof|reviews/i, /closings|carousel/i],
    sourceRequire: [
      /<V3Proof\b/,
      /<FirmClosings\b/,
      /from '@\/components\/ui\/carousel'/,
      /CarouselPrevious/,
      /CarouselNext/,
    ],
    sourceForbid: [/months of supply/i],
  },
  {
    id: '4',
    text: 'Equal four-up reach: Call, Text, Email, Schedule. No Call-dominant lead.',
    tokens: [/\bCall\b/, /\bText\b/, /\bEmail\b/, /\bSchedule\b/],
    sourceRequire: [
      /from '@\/components\/ui\/button-group'/,
      /<ButtonGroup\b/,
      />Call</,
      />Text</,
      />Email</,
      />Schedule</,
      /<V3OnDuty\b/,
    ],
    sourceForbid: [/primary:\s*true/, /v3-doors--lead/, /<V3Doors\b/],
  },
  {
    id: '5',
    text: 'Office 115 NW Oregon Ave #2 is on the page. Optional exterior of that office.',
    tokens: [/115 NW Oregon Ave #2/],
    sourceRequire: [/115 NW Oregon Ave #2/, /BRAND\.address\.street/, /ryan-realty-bend-office-exterior/],
    sourceForbid: [/ryan-realty-bend-office-interior/],
  },
  {
    id: '6',
    text: 'Firm OREA license is on the page. One-line inquiry GET-submits to /contact.',
    tokens: [/OREA/, /\/contact/],
    sourceRequire: [/FIRM_LICENSE/, /Firm OREA/, /action="\/contact"/, /method="get"/],
  },
  {
    id: '7',
    text: 'Navy and cream only. Faces at display scale. Not a second palette.',
    tokens: [/navy/i, /cream/i],
    sourceRequire: [/Navy and cream only/, /--v3-/],
    sourceForbid: [/about-fold[\s\S]{0,80}#[0-9a-fA-F]{6}/, /lab\(/],
  },
  {
    id: '8',
    text: 'Catalog interactions are real: shadcn Avatar at display scale, closings carousel, and inquiry input.',
    tokens: [/Avatar/i, /display scale/],
    sourceRequire: [
      /from '@\/components\/ui\/avatar'/,
      /from '@\/components\/ui\/carousel'/,
      /from '@\/components\/ui\/card'/,
      /from '@\/components\/ui\/input'|from '@\/components\/motion\/input'/,
      /from '@\/components\/ui\/button-group'/,
      /AvatarFallback/,
      /AvatarBadge/,
    ],
  },
  {
    id: '9',
    text: 'Below the proof, the AEO playbook: What Ryan Realty does, What makes Ryan Realty different (no competitor named), Who Ryan Realty works with, How Ryan Realty works (same business day), The team behind Ryan Realty, Key facts about Ryan Realty as one dl, and Frequently asked questions as H3s equal to FAQPage.',
    tokens: [/What Ryan Realty does/, /Key facts/, /same business day/],
    sourceRequire: [
      /<V3Entries\b/,
      /heading="What Ryan Realty does"/,
      /<V3Claims\b/,
      /heading="What makes Ryan Realty different"/,
      /<V3Roll\b/,
      /heading="Who Ryan Realty works with"/,
      /<V3Steps\b/,
      /heading="How Ryan Realty works"/,
      /heading="The team behind Ryan Realty"/,
      /<V3Facts\b/,
      /heading="Key facts about Ryan Realty"/,
      /heading="Frequently asked questions"/,
      /questionHeadings/,
      /ABOUT_REPLY_PROMISE = 'same business day'/,
      /aboutFaqItems\(proof\.faces, \{ hours: hoursLine \}\)/,
      /organizationFacts: aboutOrganizationFacts\(/,
    ],
    sourceForbid: [/term: 'Notable clients'/, /term: 'Competitors'/, /term: 'Contract terms'/],
    copyForbid: [
      ABOUT_COMPETITOR_RE,
      /\b(families|retirees|young professionals|empty nesters)\b/i,
    ],
  },
])

export function isAboutLockBrief(brief, kit) {
  if (kit === 'about') return true
  const id = isPlainObject(brief) ? String(brief.id ?? '') : ''
  return id === ABOUT_LOCK_ID || id === 'about-matt-2026-09-12' || id === 'about-researchy-1-8'
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
  const copy = sourceText != null ? String(sourceText) : readAboutLockSource(root, ABOUT_COPY_FILES).source
  const p = []
  for (const rel of read.missing) {
    p.push(`About lock missing ${rel}. The page cannot pass a beat it deleted.`)
  }
  const src = read.source
  for (const beat of ABOUT_LOCK_BEATS) {
    for (const re of beat.copyForbid ?? []) {
      const hit = copy.match(re)
      if (hit) {
        p.push(`About lock beat ${beat.id} copy names /${re.source}/ ("${hit[0]}") — ${beat.text.slice(0, 80)}`)
      }
    }
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
    p.push('About requiredComponents cannot include AboutFaces. That roster dump belongs on /team.')
  }
  if (names.includes('AboutTeamTeaser')) {
    p.push('About requiredComponents cannot include AboutTeamTeaser. Brokers belong on /team. No Meet-the-Team dump.')
  }
  if (!names.includes('AboutFirm')) {
    p.push('About requiredComponents must include AboutFirm (faces + firm story opener).')
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
