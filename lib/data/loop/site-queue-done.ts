/**
 * SITE-* Tip Ready / node-complete gate (Matt 2026-09-12).
 *
 * A cream-box receipt (Avatar import, score rise, files on disk) is not done.
 * Evidence must record grok-4.6 `demoMatch: true`. When the route publishes
 * a competitiveBrief (About first, then any kit that carries the field),
 * `parity.json` tasteReview.competitiveBriefPass must be the boolean true.
 * A hand-typed `competitiveBriefPass: true` string is refuse.
 *
 * Mirrors scripts/lib/taste-receipt.mjs `siteQueueDoneEvidenceProblems` so
 * the server DAL does not import the receipt CLI module.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TIP_READY_EVALUATOR = 'grok-4.6'
const HASH_RE = /^sha256:[0-9a-f]{64}$/

export type SiteQueueTasteReview = {
  competitiveBriefPass?: unknown
  demoMatch?: unknown
  evaluatorModel?: unknown
  shotsHash?: unknown
  competitiveBrief?: unknown
}

export type SiteQueueDoneOpts = {
  versionGap?: string | null
  competitiveBriefRequired?: boolean
  tasteReview?: SiteQueueTasteReview | null
  competitiveBrief?: unknown
  parity?: { tasteReview?: SiteQueueTasteReview; competitiveBrief?: unknown } | null
  loadParity?: boolean
  root?: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export function resolveSiteQueueKit(evidence: string, versionGap?: string | null): string | null {
  const gap = String(versionGap ?? '')
  const text = String(evidence ?? '')
  const fromPath = text.match(/ui_kits\/([a-z0-9-]+)/i)
  if (fromPath) return fromPath[1]
  const fromEval = text.match(/taste-evaluate(?:\.ts)?\s+([a-z0-9-]+)/i)
  if (fromEval) return fromEval[1]
  if (/SITE-90/.test(gap)) return 'about'
  if (/SITE-80|SITE-63/.test(gap)) return 'contact'
  if (/SITE-74/.test(gap)) return 'team'
  return null
}

function loadKitParity(kit: string | null, root = process.cwd()): Record<string, unknown> | null {
  if (!kit) return null
  const rel = join(root, 'design_system/ryan-realty/ui_kits', kit, 'parity.json')
  if (!existsSync(rel)) return null
  try {
    const parsed = JSON.parse(readFileSync(rel, 'utf8')) as unknown
    return isPlainObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

function hasStructuredBrief(raw: unknown): boolean {
  if (!isPlainObject(raw) || !Array.isArray(raw.beats)) return false
  return raw.beats.some((b) => {
    if (!isPlainObject(b)) return false
    return String(b.id ?? '').trim() !== '' && String(b.text ?? '').trim().length >= 20
  })
}

function tipReadyReceiptProblems(
  tr: SiteQueueTasteReview | null | undefined,
  { requireBrief = false, competitiveBrief = null }: { requireBrief?: boolean; competitiveBrief?: unknown } = {},
): string[] {
  if (!isPlainObject(tr)) {
    return ['tasteReview is required to mark a SITE node done. Bare evidence prose is refuse.']
  }
  const p: string[] = []
  if (String(tr.evaluatorModel ?? '').trim() !== TIP_READY_EVALUATOR) {
    p.push(
      'evaluatorModel must be grok-4.6 — the same instrument as demoMatch. Leave the node in_progress.',
    )
  }
  if (typeof tr.demoMatch !== 'boolean') {
    p.push('demoMatch must be true or false — do not invent it. Leave the node in_progress.')
  } else if (tr.demoMatch !== true) {
    p.push('demoMatch is false. Honest false stays in_progress. Do not invent demoMatch.')
  }
  if (requireBrief || hasStructuredBrief(competitiveBrief) || hasStructuredBrief(tr.competitiveBrief)) {
    if (tr.competitiveBriefPass !== true) {
      p.push(
        'parity tasteReview.competitiveBriefPass must be the boolean true. Bare evidence prose is refuse. Leave the node in_progress.',
      )
    }
  }
  if (tr.shotsHash != null && !HASH_RE.test(String(tr.shotsHash).trim())) {
    p.push('tasteReview.shotsHash must be sha256:<64 hex> like a v2 receipt.')
  }
  return p
}

export function siteQueueDoneEvidenceProblems(
  evidence: string,
  {
    versionGap,
    competitiveBriefRequired,
    tasteReview,
    competitiveBrief,
    parity,
    loadParity,
    root,
  }: SiteQueueDoneOpts = {},
): string[] {
  const gap = String(versionGap ?? '')
  if (gap && !/^SITE-\d+/.test(gap)) return []
  const text = String(evidence ?? '')
  if (!text.trim()) return ['evidence is required — a node is done when the environment says so']
  if (/\b402\b/.test(text) && /grok|taste-evaluate|quota|payment required/i.test(text)) {
    return ['grok CLI 402 — do not invent demoMatch. Leave the node in_progress.']
  }
  if (/no grok CLI|grok CLI missing|GROK_CLI/i.test(text)) {
    return ['grok CLI missing — do not invent demoMatch. Leave the node in_progress.']
  }
  if (/\bdemoMatch\b\s*[:=]\s*false\b/i.test(text)) {
    return ['evidence records demoMatch false — not done. Leave the node in_progress.']
  }
  if (!/\bdemoMatch\b\s*[:=]\s*true\b/i.test(text)) {
    return [
      'SITE done evidence must include demoMatch: true from grok-4.6. Score rise without a demo match is not Tip Ready.',
    ]
  }
  if (/\bcompetitiveBriefPass\b\s*[:=]\s*false\b/i.test(text)) {
    return [
      'evidence records competitiveBriefPass false — Looking invented past the brief, or the checklist is not all true. Not done. Leave the node in_progress.',
    ]
  }

  const kit = resolveSiteQueueKit(text, gap)
  const loaded = loadParity === false ? null : isPlainObject(parity) ? parity : loadKitParity(kit, root)
  const tr = isPlainObject(tasteReview) ? tasteReview : (loaded?.tasteReview as SiteQueueTasteReview | undefined)
  const brief = competitiveBrief ?? loaded?.competitiveBrief
  const needsBrief =
    competitiveBriefRequired === true ||
    hasStructuredBrief(brief) ||
    /SITE-90/.test(gap) ||
    /taste-evaluate(?:\.ts)?\s+about\b/i.test(text) ||
    /ui_kits\/about/i.test(text)
  const claimsBriefPass = /\bcompetitiveBriefPass\b\s*[:=]\s*true\b/i.test(text)

  if (needsBrief && !claimsBriefPass) {
    return [
      'SITE done evidence must include competitiveBriefPass: true. Score rise without the Researchy brief is not Tip Ready.',
    ]
  }
  if (needsBrief || claimsBriefPass) {
    return tipReadyReceiptProblems(tr, { competitiveBrief: brief, requireBrief: true })
  }
  return []
}
