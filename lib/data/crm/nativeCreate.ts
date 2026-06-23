import type { CrmBrokerSlug } from '@/lib/crm/constants'

/**
 * Canonical native crm_people create-row builder (CONTACT360 Phase 0.4 — no thin
 * native-create paths). Two helpers create a native lead row: ensureNativeLead
 * (FUB-push-failure fallback for the LP paths) and findOrCreatePersonByPhone
 * (inbound SMS / voice). They MUST write the same complete shape — a real source,
 * stage 'Lead', an assigned broker, a `source:<x>` tag, and (downstream) a
 * normalized crm_contact_points row — or a native lead lands incomplete and
 * invisible to the workflow. This single builder is the chokepoint that keeps the
 * two paths from drifting: both call it for the crm_people insert payload, so a
 * field added here lands on every native-create path at once.
 *
 * Pure + unit-tested (no Supabase). The .from('crm_people').insert(...) call
 * itself stays in the DAL helpers (G1); this only assembles the row.
 */

/** Every native-create path routes to Matt unless the caller staffs it otherwise. */
export const NATIVE_DEFAULT_BROKER: CrmBrokerSlug = 'matt'

export type NativePersonRow = {
  name: string
  first_name: string | null
  last_name: string | null
  stage: 'Lead'
  source: string
  assigned_broker: CrmBrokerSlug
  emails: Array<{ value: string; type: string; isPrimary: number }>
  phones: Array<{ value: string; type: string; isPrimary: number }>
  tags: string[]
}

/**
 * Build the complete crm_people insert payload for a native-create path.
 *
 * Invariants (the create-completeness contract both native paths share):
 *   - `source` is the trimmed origin label (e.g. 'inbound-call', 'seller-lp');
 *     a blank source is never written — it falls back to the generic 'native-lead'
 *     so the row is always attributable (ci:crm-lead-integrity: source required).
 *   - `stage` is always 'Lead'.
 *   - `assigned_broker` is always set (defaults to Matt) so the lead is owned, not
 *     orphaned/invisible.
 *   - `tags` always contains `source:<source>` and is deduped; extra caller tags
 *     (audience:*, seller:*, intent:*, ...) are merged in, in order, deduped.
 */
export function buildNativePersonRow(input: {
  name: string
  first_name: string | null
  last_name: string | null
  source: string
  assignedBroker?: CrmBrokerSlug
  emails?: Array<{ value: string; type: string; isPrimary: number }>
  phones?: Array<{ value: string; type: string; isPrimary: number }>
  tags?: string[]
}): NativePersonRow {
  const source = input.source.trim() || 'native-lead'
  const tags = [...new Set([`source:${source}`, ...(input.tags ?? [])])]
  return {
    name: input.name,
    first_name: input.first_name,
    last_name: input.last_name,
    stage: 'Lead',
    source,
    assigned_broker: input.assignedBroker ?? NATIVE_DEFAULT_BROKER,
    emails: input.emails ?? [],
    phones: input.phones ?? [],
    tags,
  }
}

/**
 * Assert (for tests + as living documentation) that a built row satisfies the
 * native-create completeness contract: real source, stage Lead, an owner, a
 * matching source tag, and at least one contactable point (email or phone) so the
 * downstream crm_contact_points row can be keyed. Returns the list of gaps — an
 * empty list means a complete person.
 */
export function nativeCreateGaps(row: NativePersonRow): string[] {
  const gaps: string[] = []
  if (!row.source || !row.source.trim()) gaps.push('missing source')
  if (row.stage !== 'Lead') gaps.push('stage is not Lead')
  if (!row.assigned_broker) gaps.push('missing assigned_broker')
  if (!row.tags.includes(`source:${row.source}`)) gaps.push('missing source:<source> tag')
  if (row.emails.length === 0 && row.phones.length === 0) gaps.push('no contactable point (email or phone)')
  return gaps
}
