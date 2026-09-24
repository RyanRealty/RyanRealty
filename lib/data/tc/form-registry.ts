/**
 * The Vault form registry as the Forms page shows it: every form the document
 * reader has met, its numbers and releases, who must sign it and what decided
 * that (lib/tc/doc-read/registry.ts). Read-only. Raw .from() stays here (G1).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type FormRegistryObligation =
  | { kind: 'all'; parties: string[]; optional?: string[] }
  | { kind: 'one_side'; parties: string[] }
  | { kind: 'reference' }

export type FormRegistryRow = {
  identity: string
  title: string
  numbers: Record<string, number>
  releases: Record<string, number>
  category: string
  obligation: FormRegistryObligation
  basis: 'library' | 'law' | 'category' | 'blocks' | 'person'
  rule: string
  confidence: 'library' | 'rule' | 'consensus' | 'new'
  copies: number
  libraryKey: string | null
  libraryDisagrees: boolean
  firstSeenAt: string
  lastSeenAt: string
}

export async function listFormRegistry(): Promise<FormRegistryRow[]> {
  const sb = createServiceClient()
  const out: FormRegistryRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('tc_form_registry')
      .select('identity, title, numbers, releases, category, obligation, basis, rule, confidence, copies, library_key, library_disagrees, first_seen_at, last_seen_at')
      .order('copies', { ascending: false })
      .range(from, from + 999)
    if (error) {
      console.error('[listFormRegistry]', error.message)
      return out
    }
    for (const r of data ?? []) {
      out.push({
        identity: String(r.identity),
        title: String(r.title),
        numbers: (r.numbers as Record<string, number> | null) ?? {},
        releases: (r.releases as Record<string, number> | null) ?? {},
        category: String(r.category),
        obligation: r.obligation as FormRegistryObligation,
        basis: r.basis as FormRegistryRow['basis'],
        rule: String(r.rule),
        confidence: r.confidence as FormRegistryRow['confidence'],
        copies: Number(r.copies ?? 0),
        libraryKey: (r.library_key as string | null) ?? null,
        libraryDisagrees: !!r.library_disagrees,
        firstSeenAt: String(r.first_seen_at),
        lastSeenAt: String(r.last_seen_at),
      })
    }
    if (!data || data.length < 1000) break
  }
  return out
}
