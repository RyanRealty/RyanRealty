/**
 * getContactCmas — the contact page's view of public.cmas (the in-house CMA
 * engine's system of record): every CMA built for this contact, matched by the
 * contact's email addresses against cmas.client_email. Powers the right-rail
 * "CMAs" card (review draft / send finalized / re-send delivered).
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type ContactCma = {
  slug: string
  subjectAddress: string
  status: string
  /** $ range when priced, e.g. "$780,000 – $820,000". */
  valueLine: string | null
  createdAt: string
  deliveredAt: string | null
  previewUrl: string | null
}

function usd(n: unknown): string | null {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return null
  return `$${(Math.round(v / 1000) * 1000).toLocaleString('en-US')}`
}

export async function getContactCmas(params: {
  crmPersonId: number
  emails: string[]
}): Promise<ContactCma[]> {
  const emails = params.emails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (emails.length === 0) return []
  const sb = createServiceClient()
  const { data } = await sb
    .from('cmas')
    .select('slug,subject_address,status,value_low,value_high,created_at,delivered_at,preview_url,client_email')
    .in('client_email', emails)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(5)
  return (data ?? []).map((r) => {
    const low = usd(r.value_low)
    const high = usd(r.value_high)
    return {
      slug: String(r.slug),
      subjectAddress: String(r.subject_address ?? ''),
      status: String(r.status ?? 'draft'),
      valueLine: low && high ? `${low} – ${high}` : (low ?? high),
      createdAt: String(r.created_at),
      deliveredAt: (r.delivered_at as string | null) ?? null,
      previewUrl: (r.preview_url as string | null) ?? null,
    }
  })
}
