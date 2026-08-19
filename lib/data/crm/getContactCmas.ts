/**
 * getContactCmas — the contact page's view of public.cmas (the in-house CMA
 * engine's system of record). Prefers the stable person_id link (W5.1), with
 * client_email fallback for older rows. Powers the SendPanel CMA tab +
 * right-rail card (review / attach in Messages).
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { cmaHasStoredHtml } from '@/lib/cma/draft-access'

export type CmaBuildState = 'queued' | 'building' | 'ready' | 'failed'

export type ContactCma = {
  slug: string
  subjectAddress: string
  status: string
  buildState: CmaBuildState
  /** $ range when priced, e.g. "$780,000 – $820,000". */
  valueLine: string | null
  createdAt: string
  deliveredAt: string | null
  /** Always derived from slug — never gated on never-populated preview_url. */
  reviewUrl: string
  /** Stored HTML or a finished build — compose can attach a PDF. */
  hasDocument: boolean
}

function usd(n: unknown): string | null {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return null
  return `$${(Math.round(v / 1000) * 1000).toLocaleString('en-US')}`
}

function asBuildState(raw: unknown): CmaBuildState {
  const s = String(raw ?? 'ready')
  if (s === 'queued' || s === 'building' || s === 'ready' || s === 'failed') return s
  return 'ready'
}

export async function getContactCmas(params: {
  crmPersonId: number
  emails: string[]
}): Promise<ContactCma[]> {
  const emails = params.emails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  const personId = params.crmPersonId
  if (!Number.isFinite(personId) || personId <= 0) return []

  const sb = createServiceClient()
  const select =
    'slug,subject_address,status,build_state,value_low,value_high,created_at,delivered_at,client_email,person_id,html_path,built_at'

  // person_id first; email fallback for pre-migration rows that never got a link.
  const byPerson = await sb
    .from('cmas')
    .select(select)
    .eq('person_id', personId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  let rows = byPerson.data ?? []
  if (rows.length === 0 && emails.length > 0) {
    const byEmail = await sb
      .from('cmas')
      .select(select)
      .in('client_email', emails)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5)
    rows = byEmail.data ?? []
  }

  return rows.map((r) => {
    const low = usd(r.value_low)
    const high = usd(r.value_high)
    const slug = String(r.slug)
    return {
      slug,
      subjectAddress: String(r.subject_address ?? ''),
      status: String(r.status ?? 'draft'),
      buildState: asBuildState(r.build_state),
      valueLine: low && high ? `${low} – ${high}` : (low ?? high),
      createdAt: String(r.created_at),
      deliveredAt: (r.delivered_at as string | null) ?? null,
      reviewUrl: `/admin/cmas/${slug}`,
      hasDocument:
        cmaHasStoredHtml(r.html_path) ||
        String(r.html_path ?? '').startsWith('public/cmas/') ||
        Boolean(r.built_at) ||
        asBuildState(r.build_state) === 'ready',
    }
  })
}
