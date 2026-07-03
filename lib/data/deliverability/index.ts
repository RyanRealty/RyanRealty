import 'server-only'
import { createServiceClient } from '@/lib/data/client'

/**
 * Deliverability DAL (spec §6.7). Reads the latest Google Postmaster reputation
 * snapshot for a sending domain from deliverability_metrics (populated by the
 * /api/cron/postmaster-sync cron). The pre-send guard (§6.5 rule 4 / G-NL-20)
 * uses deliverabilityVerdict() to BLOCK a large bulk send on a LOW/BAD Gmail
 * reputation or a spam rate over 0.30%, with a no-data → warm-up fallback (the
 * first sends have no Postmaster data yet — Gmail only reports after volume flows).
 */

export const NEWSLETTER_SEND_DOMAIN = 'news.ryan-realty.com'

export type DeliverabilityRow = {
  domain: string
  metric_date: string
  spam_ratio: number | null
  domain_reputation: string | null // HIGH | MEDIUM | LOW | BAD
  spf_ok: boolean | null
  dkim_ok: boolean | null
  dmarc_ok: boolean | null
  fetched_at: string
}

/** Latest Postmaster snapshot for a domain, or null if none yet. */
export async function getLatestDeliverability(domain = NEWSLETTER_SEND_DOMAIN): Promise<DeliverabilityRow | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('deliverability_metrics')
    .select('domain, metric_date, spam_ratio, domain_reputation, spf_ok, dkim_ok, dmarc_ok, fetched_at')
    .eq('domain', domain)
    .order('metric_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as DeliverabilityRow | null) ?? null
}

export type DeliverabilityVerdict = { action: 'allow' | 'warn' | 'block' | 'warmup'; reason: string }

/**
 * The pre-send verdict (G-NL-20). Pure over a snapshot so it is unit-testable:
 *   - no data          → 'warmup'  (defer to the warm-up ramp — never full-blast, never block)
 *   - LOW/BAD reputation OR spam_ratio > 0.30% → 'block'
 *   - MEDIUM reputation OR spam_ratio > 0.10%  → 'warn'  (require confirm)
 *   - otherwise         → 'allow'
 */
export function deliverabilityVerdict(row: DeliverabilityRow | null): DeliverabilityVerdict {
  if (!row) return { action: 'warmup', reason: 'no Postmaster data yet — defer to the warm-up ramp (§6.5)' }
  const rep = (row.domain_reputation ?? '').toUpperCase()
  const spam = row.spam_ratio ?? 0
  if (rep === 'LOW' || rep === 'BAD' || spam > 0.003) {
    return { action: 'block', reason: `Gmail reputation ${rep || 'unknown'}, spam rate ${(spam * 100).toFixed(2)}% — over the 0.30% ceiling` }
  }
  if (rep === 'MEDIUM' || spam > 0.001) {
    return { action: 'warn', reason: `Gmail reputation ${rep || 'unknown'}, spam rate ${(spam * 100).toFixed(2)}% — proceed with caution` }
  }
  return { action: 'allow', reason: `Gmail reputation ${rep || 'HIGH'}, spam rate ${(spam * 100).toFixed(2)}%` }
}
