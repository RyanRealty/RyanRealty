/**
 * Case-insensitive email → crm_people.id resolution.
 *
 * crm_people.emails is jsonb and ~25% of stored addresses carry uppercase (never
 * normalized at write time). A jsonb `@>` containment is byte-exact, so a lowercased
 * query silently MISSES a person stored "Jane@X.com" — which, in the suppression
 * path, skips their compliance tags and could email an opted-out person. This routes
 * through the `crm_person_ids_by_email_ci` SQL function (matches over lower(value)),
 * so every email→person lookup is correct regardless of stored case.
 *
 * Raw .from()/.rpc() lives in lib/data per the DAL boundary (G1).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns the ids of every crm person carrying `email` (case-insensitive). THROWS on
 * a DB error so callers fail closed (a swallowed error must not read as "no match").
 */
export async function personIdsByEmailCi(sb: SupabaseClient, email: string): Promise<number[]> {
  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized) return []
  const { data, error } = await sb.rpc('crm_person_ids_by_email_ci', { p_email: normalized })
  if (error) throw new Error(`personIdsByEmailCi: ${error.message}`)
  return ((data ?? []) as unknown[])
    .map((r) =>
      typeof r === 'object' && r
        ? Number((r as Record<string, unknown>).crm_person_ids_by_email_ci)
        : Number(r),
    )
    .filter((n) => Number.isFinite(n))
}
