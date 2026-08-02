/**
 * lib/data/agent/legal.ts — the ONLY module that touches public.legal_corpus
 * (G1 DAL boundary). docs/plans/BROKER_SMS_AGENT_2026-07-31.md R4.1/R4.2.
 *
 * legal_corpus is service-role only (RLS on, zero policies —
 * supabase/migrations/20260801051000_broker_sms_agent_tables.sql), so every
 * read here goes through createServiceClient(), never supabaseAnon/supabaseServer.
 * Populated by scripts/ingest-legal-corpus.mjs from three sources: 'ors'
 * (ORS chapter 696), 'oar' (OAR chapter 863), and 'matrix' (the in-repo
 * docs/TC_OREGON_COMPLIANCE.md + lib/tc/required-documents.ts citations).
 *
 * Also owns the "flag a law question to Matt" side effect: a crm_broker_alerts
 * insert, following the same shape as lib/data/crm/healthAlertQueue.ts
 * (broker: 'matt', to_phone, body, person_id: null, status default 'pending').
 * Principal-broker supervision of law Q&A is a legal duty (R4.4), not a nicety.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'
import type { BrokerSlug } from '@/lib/agent/types'

export type LegalCorpusSource = 'ors' | 'oar' | 'matrix'

export interface LegalCorpusHit {
  citation: string
  heading: string | null
  /** ~400 chars of body text centered on the query match (or the opening of the body if no match). */
  snippet: string
  url: string | null
  corpusVersion: string
  effectiveDate: string | null
}

export interface LegalCorpusCounts {
  bySource: Record<LegalCorpusSource, number>
  total: number
  latestVersion: string | null
}

type LegalCorpusRow = {
  citation: string
  heading: string | null
  body: string
  url: string | null
  corpus_version: string
  effective_date: string | null
}

const SELECT_COLUMNS = 'citation, heading, body, url, corpus_version, effective_date'
const SOURCES: LegalCorpusSource[] = ['ors', 'oar', 'matrix']

/** ~400 chars of `body` centered on the first query word found, else the opening of the body. */
function snippetAround(body: string, query: string, radius = 200): string {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
  const lower = body.toLowerCase()

  let idx = -1
  for (const w of words) {
    const i = lower.indexOf(w)
    if (i !== -1 && (idx === -1 || i < idx)) idx = i
  }

  if (idx === -1) return body.slice(0, 400).trim()

  const start = Math.max(0, idx - radius)
  const end = Math.min(body.length, idx + radius)
  const prefix = start > 0 ? '… ' : ''
  const suffix = end < body.length ? ' …' : ''
  return `${prefix}${body.slice(start, end).trim()}${suffix}`
}

function toHit(row: LegalCorpusRow, query: string): LegalCorpusHit {
  return {
    citation: row.citation,
    heading: row.heading,
    snippet: snippetAround(row.body, query),
    url: row.url,
    corpusVersion: row.corpus_version,
    effectiveDate: row.effective_date,
  }
}

/**
 * Search the corpus for `query`, returning up to `limit` hits.
 *
 * Primary path: Postgres full-text search over the `body` column
 * (`.textSearch` with `websearch` semantics — handles quoted phrases, "or",
 * "-exclude"). This does NOT ride the table's GIN expression index (which
 * covers to_tsvector(heading || ' ' || body), not to_tsvector(body) alone) —
 * an acceptable sequential scan at this corpus's size (~350 rows as of the
 * 2026-08-01 ingest; see scripts/ingest-legal-corpus.mjs).
 *
 * Fallback: a broker's phrasing ("do I need a lead paint disclosure") often
 * shares more vocabulary with the CITATION or HEADING (short, keyword-dense)
 * than with dense statute prose. If FTS falls short of `limit`, widen with an
 * ILIKE pass over citation + heading and append any new rows.
 */
export async function searchLegalCorpus(query: string, limit = 5): Promise<LegalCorpusHit[]> {
  const cleaned = query.trim()
  if (!cleaned) return []

  const sb = createServiceClient()
  const rows: LegalCorpusRow[] = []
  const seen = new Set<string>()

  const { data: ftsRows, error: ftsError } = await sb
    .from('legal_corpus')
    .select(SELECT_COLUMNS)
    .textSearch('body', cleaned, { type: 'websearch', config: 'english' })
    .limit(limit)

  if (ftsError) {
    console.warn('[legal] searchLegalCorpus FTS error:', ftsError.message)
  }
  for (const r of (ftsRows as LegalCorpusRow[] | null) ?? []) {
    if (!seen.has(r.citation)) {
      rows.push(r)
      seen.add(r.citation)
    }
  }

  if (rows.length < limit) {
    const pattern = `%${cleaned.replace(/[%_]/g, '')}%`
    const { data: likeRows, error: likeError } = await sb
      .from('legal_corpus')
      .select(SELECT_COLUMNS)
      .or(`citation.ilike.${pattern},heading.ilike.${pattern}`)
      .limit(limit - rows.length + seen.size)

    if (likeError) console.warn('[legal] searchLegalCorpus ILIKE fallback error:', likeError.message)
    for (const r of (likeRows as LegalCorpusRow[] | null) ?? []) {
      if (rows.length >= limit) break
      if (!seen.has(r.citation)) {
        rows.push(r)
        seen.add(r.citation)
      }
    }
  }

  return rows.slice(0, limit).map((r) => toHit(r, cleaned))
}

/** The newest corpus_version present in the table (most recent ingest run), or null if empty. */
export async function latestCorpusVersion(): Promise<string | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('legal_corpus')
    .select('corpus_version')
    .order('corpus_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[legal] latestCorpusVersion error:', error.message)
    return null
  }
  return (data as { corpus_version: string } | null)?.corpus_version ?? null
}

/** Row counts per source (all corpus_versions) plus the latest ingested version — a health/debug surface. */
export async function corpusCounts(): Promise<LegalCorpusCounts> {
  const sb = createServiceClient()
  const bySource = {} as Record<LegalCorpusSource, number>
  let total = 0

  for (const source of SOURCES) {
    const { count, error } = await sb.from('legal_corpus').select('id', { count: 'exact', head: true }).eq('source', source)
    if (error) {
      console.warn(`[legal] corpusCounts(${source}) error:`, error.message)
      bySource[source] = 0
      continue
    }
    bySource[source] = count ?? 0
    total += count ?? 0
  }

  return { bySource, total, latestVersion: await latestCorpusVersion() }
}

/**
 * Flag a law question to Matt (principal broker) via a crm_broker_alerts row —
 * same insert shape as lib/data/crm/healthAlertQueue.ts's insertHealthAlert
 * (broker/to_phone/body/person_id: null, status defaults to 'pending' and the
 * existing alert-drain cron delivers it to Matt's cell).
 *
 * Two callers per the R4.3 contract: a deal-specific question (never answered
 * in-thread — routed to Matt outright) and a general question with zero
 * corpus hits (honestly "not in my corpus", also routed to Matt so a real
 * rule gap gets noticed instead of silently swallowed). `reason` is accepted
 * for the caller's own logging/telemetry; the wire body stays the literal
 * contract string so any downstream parsing of this alert type is stable.
 */
export async function flagLawQuestionToMatt(params: {
  brokerSlug: BrokerSlug
  question: string
  reason: 'deal-specific' | 'not-in-corpus'
}): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const tel = await getBrokerTelephony()
    const toPhone = tel.bySlug.matt?.forwardToCell || process.env.TWILIO_FORWARD_MATT
    if (!toPhone) {
      console.warn('[legal] flagLawQuestionToMatt: no phone configured for matt')
      return false
    }

    const body = `Law Q flagged from ${params.brokerSlug}: ${params.question}`.slice(0, 600)
    const { error } = await sb.from('crm_broker_alerts').insert({
      broker: 'matt',
      to_phone: toPhone,
      body,
      person_id: null,
      status: 'pending',
    })
    if (error) {
      console.warn('[legal] flagLawQuestionToMatt insert error:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[legal] flagLawQuestionToMatt error:', err)
    return false
  }
}
