/**
 * External verification fleet (Grok Bots) — findings inbox DAL.
 * Not on the public barrel (file-size budget).
 * reachability: entry-point /api/fleet/findings + scripts/fleet-intake.ts
 *
 * Bots browse production like users and report structured findings; the
 * intake script converts confirmed findings into work-graph nodes. A finding
 * without expected/observed/url evidence is rejected at the door — the fleet
 * feeds the loop facts, not vibes.
 */
import 'server-only'

import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { isCompanyImprovementDomain } from './domains'

export const FLEET_SEVERITIES = ['p0', 'major', 'minor', 'info'] as const
export type FleetSeverity = (typeof FLEET_SEVERITIES)[number]

export type FleetFindingDraft = {
  bot: string
  caseId?: string | null
  url: string
  viewport?: string | null
  expected: string
  observed: string
  severity?: string | null
  evidence?: string | null
  domain?: string | null
}

export type FleetFinding = FleetFindingDraft & {
  id: string
  status: 'new' | 'confirmed' | 'node_created' | 'duplicate' | 'rejected'
  fingerprint: string
  nodeId: string | null
  createdAt: string
}

/** Stable identity for a defect: same page + same mismatch = same finding. */
export function findingFingerprint(input: { url: string; expected: string; observed: string }): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 500)
  return createHash('sha256')
    .update(`${norm(input.url)}|${norm(input.expected)}|${norm(input.observed)}`)
    .digest('hex')
    .slice(0, 32)
}

export function validateFindingDraft(input: unknown): { draft: FleetFindingDraft | null; error: string | null } {
  if (typeof input !== 'object' || input == null) return { draft: null, error: 'body must be a JSON object' }
  const b = input as Record<string, unknown>
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() : '')
  const bot = str('bot')
  const url = str('url')
  const expected = str('expected')
  const observed = str('observed')
  if (!bot) return { draft: null, error: 'bot is required' }
  if (!/^https?:\/\//.test(url)) return { draft: null, error: 'url must be absolute (the page where you saw it)' }
  if (expected.length < 10) return { draft: null, error: 'expected is required — what SHOULD be true, from your case brief' }
  if (observed.length < 10) return { draft: null, error: 'observed is required — what you actually saw' }
  if (expected.length > 2000 || observed.length > 2000 || url.length > 1000) {
    return { draft: null, error: 'field too long (2000 char max)' }
  }
  const severity = str('severity') || 'minor'
  if (!(FLEET_SEVERITIES as readonly string[]).includes(severity)) {
    return { draft: null, error: `severity must be one of ${FLEET_SEVERITIES.join(', ')}` }
  }
  const domain = str('domain') || null
  if (domain && !isCompanyImprovementDomain(domain)) {
    return { draft: null, error: 'domain must be a company domain or omitted' }
  }
  return {
    draft: {
      bot: bot.slice(0, 100),
      caseId: str('caseId') || null,
      url,
      viewport: str('viewport') || null,
      expected,
      observed,
      severity,
      evidence: str('evidence') || null,
      domain,
    },
    error: null,
  }
}

export async function insertFleetFinding(
  draft: FleetFindingDraft,
): Promise<{ data: { id: string; duplicate: boolean } | null; error: string | null }> {
  try {
    const sb = createServiceClient()
    const fingerprint = findingFingerprint(draft)
    const { data, error } = await sb
      .from('fleet_findings')
      .insert({
        bot: draft.bot,
        case_id: draft.caseId ?? null,
        url: draft.url,
        viewport: draft.viewport ?? null,
        expected: draft.expected,
        observed: draft.observed,
        severity: draft.severity ?? 'minor',
        evidence: draft.evidence ?? null,
        domain: draft.domain ?? null,
        fingerprint,
      })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') return { data: { id: fingerprint, duplicate: true }, error: null }
      console.error('[insertFleetFinding]', error.message)
      return { data: null, error: error.message }
    }
    return { data: { id: data.id as string, duplicate: false }, error: null }
  } catch (err) {
    console.error('[insertFleetFinding]', err)
    return { data: null, error: err instanceof Error ? err.message : 'insert failed' }
  }
}

export async function listNewFindings(): Promise<FleetFinding[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('fleet_findings')
    .select('id,bot,case_id,url,viewport,expected,observed,severity,evidence,domain,status,fingerprint,node_id,created_at')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[listNewFindings]', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    bot: String(r.bot),
    caseId: r.case_id == null ? null : String(r.case_id),
    url: String(r.url),
    viewport: r.viewport == null ? null : String(r.viewport),
    expected: String(r.expected),
    observed: String(r.observed),
    severity: String(r.severity),
    evidence: r.evidence == null ? null : String(r.evidence),
    domain: r.domain == null ? null : String(r.domain),
    status: r.status as FleetFinding['status'],
    fingerprint: String(r.fingerprint),
    nodeId: r.node_id == null ? null : String(r.node_id),
    createdAt: String(r.created_at),
  }))
}

export async function markFinding(
  id: string,
  status: 'confirmed' | 'node_created' | 'duplicate' | 'rejected',
  nodeId?: string | null,
): Promise<{ error: string | null }> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('fleet_findings')
    .update({ status, node_id: nodeId ?? null, triaged_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    console.error('[markFinding]', error.message)
    return { error: error.message }
  }
  return { error: null }
}
