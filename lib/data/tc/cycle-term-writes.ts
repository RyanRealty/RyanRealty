import 'server-only'

/**
 * Writes to a cycle's term columns that record who wrote them
 * (tc_cycles.term_provenance, lib/tc/terms/provenance.ts). Matt 2026-09-24:
 * "Contract wins, unless a person typed it" — so every writer says whether a
 * person typed the value. A broker's own edits go through writeCycleTermsByPerson;
 * the machine writers (SkySlope intake, email facts) stamp through
 * stampedTermsPatch.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { stampProvenance, type ProvenanceBy } from '@/lib/tc/terms/provenance'

type Obj = Record<string, unknown>

/**
 * The patch plus the updated term_provenance for a write by `by`. Reads the
 * cycle's current provenance; the caller applies the patch with its own
 * guards.
 */
export async function stampedTermsPatch(
  sb: SupabaseClient,
  cycleId: string,
  patch: Obj,
  by: ProvenanceBy,
  meta: { actor?: string | null; document?: string | null; page?: number | null } = {},
): Promise<Obj> {
  const { data } = await sb.from('tc_cycles').select('term_provenance').eq('id', cycleId).maybeSingle()
  return { ...patch, term_provenance: stampProvenance(data?.term_provenance ?? {}, patch, by, meta) }
}

/**
 * A broker's own edit of a cycle's terms: the values, stamped as typed by a
 * person, and one tc_events row naming the fields. The caller checks the
 * broker may edit this file.
 */
export async function writeCycleTermsByPerson(
  input: { cycleId: string; patch: Obj; actor: string; action: string; detail?: Obj },
  sb: SupabaseClient = createServiceClient(),
): Promise<{ ok: boolean; error?: string; dealId?: string | null }> {
  const at = new Date().toISOString()
  const stamped = await stampedTermsPatch(sb, input.cycleId, input.patch, 'person', { actor: input.actor })
  const { data, error } = await sb
    .from('tc_cycles')
    .update({ ...stamped, updated_at: at })
    .eq('id', input.cycleId)
    .select('deal_id')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'That cycle is gone.' }
  await sb.from('tc_events').insert({
    deal_id: data.deal_id ?? null,
    cycle_id: input.cycleId,
    actor: input.actor,
    action: input.action,
    detail: { ...(input.detail ?? {}), fields: input.patch },
  })
  return { ok: true, dealId: (data.deal_id as string | null) ?? null }
}
