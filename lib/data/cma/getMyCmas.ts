/**
 * getMyCmas — the /account overview's view of public.cmas (the in-house CMA
 * engine's system of record). Returns ONLY CMAs actually delivered to this
 * consumer: client_email match, delivered_at set, not archived. A signed-in
 * visitor must never see an internal draft — this reader has no path that
 * could return one.
 *
 * DAL boundary (G1): the raw .from() read lives here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type MyCma = {
  slug: string
  subjectAddress: string
  deliveredAt: string
}

export async function getMyCmas(email: string | null | undefined): Promise<MyCma[]> {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!normalized) return []

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('cmas')
    .select('slug, subject_address, delivered_at')
    .eq('client_email', normalized)
    .not('delivered_at', 'is', null)
    .is('archived_at', null)
    .order('delivered_at', { ascending: false })
    .limit(10)
  if (error) throw new Error(`getMyCmas read failed: ${error.message}`)

  return (data ?? []).map((r) => ({
    slug: String(r.slug),
    subjectAddress: String(r.subject_address ?? ''),
    deliveredAt: String(r.delivered_at),
  }))
}
