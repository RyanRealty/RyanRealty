/**
 * SITE-* Tip Ready / node-complete gate (Matt 2026-09-12).
 *
 * A cream-box receipt (Avatar import, score rise, files on disk) is not done.
 * Evidence must record grok-4.6 `demoMatch: true`. When the route publishes
 * a competitiveBrief (About first), evidence must also record
 * `competitiveBriefPass: true`. CLI missing / 402 is an honest fail — leave
 * the node in_progress. Omit is refuse. Do not invent true.
 *
 * Mirrors scripts/lib/taste-receipt.mjs `siteQueueDoneEvidenceProblems` so
 * the server DAL does not import the receipt CLI module.
 */
export function siteQueueDoneEvidenceProblems(
  evidence: string,
  { versionGap, competitiveBriefRequired }: { versionGap?: string | null; competitiveBriefRequired?: boolean } = {},
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
  const needsBrief =
    competitiveBriefRequired === true ||
    /SITE-90/.test(gap) ||
    /taste-evaluate(?:\.ts)?\s+about\b/i.test(text) ||
    /ui_kits\/about/i.test(text)
  if (needsBrief && !/\bcompetitiveBriefPass\b\s*[:=]\s*true\b/i.test(text)) {
    return [
      'SITE done evidence must include competitiveBriefPass: true (or checklist all true). Score rise without the Researchy brief is not Tip Ready.',
    ]
  }
  return []
}
