/**
 * The MLS subdivision of each file's property, by its cycles' MLS numbers.
 * Brokers and clients call a file by its subdivision ("Valhalla Heights" is
 * 2680 NW Nordic Ave), so the Vault mail filer (lib/tc/mail-rules.ts) reads
 * it as a name for the file. Raw .from() stays here (G1).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

/** MLS number → SubdivisionName, for the numbers given. Numbers with no listing row are absent. */
export async function getSubdivisionNamesByMlsNumbers(mlsNumbers: readonly string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(mlsNumbers.map((n) => String(n ?? '').trim()).filter((n) => /^\d{6,}$/.test(n)))]
  const out = new Map<string, string>()
  const sb = createServiceClient()
  for (let i = 0; i < wanted.length; i += 200) {
    const { data, error } = await sb.from('listings').select('ListNumber, SubdivisionName').in('ListNumber', wanted.slice(i, i + 200))
    if (error) throw new Error(`subdivisions by MLS number: ${error.message}`)
    for (const r of (data ?? []) as Array<{ ListNumber: string | null; SubdivisionName: string | null }>) {
      const name = String(r.SubdivisionName ?? '').trim()
      if (r.ListNumber && name) out.set(String(r.ListNumber), name)
    }
  }
  return out
}
