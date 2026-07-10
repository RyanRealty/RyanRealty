/**
 * getContactBpos — the contact page's view of public.broker_price_opinions:
 * every Broker Price Opinion built for this contact, matched by the contact's
 * crm_people.id against broker_price_opinions.person_id. Powers the right-rail
 * "Broker Price Opinions" card (review draft / open finalized).
 *
 * DAL boundary (G1): the raw .from() read lives here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type ContactBpo = {
  slug: string
  subjectAddress: string
  status: string
  subjectStatus: string | null
  /** Opinion of value, formatted, e.g. "$1,150,000". */
  opinionLine: string | null
  confidence: string | null
  createdAt: string
  previewUrl: string
}

function usd(n: unknown): string | null {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return null
  return `$${(Math.round(v / 1000) * 1000).toLocaleString('en-US')}`
}

export async function getContactBpos(params: {
  crmPersonId: number
  emails?: string[]
}): Promise<ContactBpo[]> {
  if (!Number.isFinite(params.crmPersonId) || params.crmPersonId <= 0) return []
  const sb = createServiceClient()
  const { data } = await sb
    .from('broker_price_opinions')
    .select('slug,subject_address,status,subject_status,opinion_value,confidence,created_at')
    .eq('person_id', params.crmPersonId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(5)
  return (data ?? []).map((r) => ({
    slug: String(r.slug),
    subjectAddress: String(r.subject_address ?? ''),
    status: String(r.status ?? 'draft'),
    subjectStatus: (r.subject_status as string | null) ?? null,
    opinionLine: usd(r.opinion_value),
    confidence: (r.confidence as string | null) ?? null,
    createdAt: String(r.created_at),
    previewUrl: `/bpo/${String(r.slug)}`,
  }))
}
