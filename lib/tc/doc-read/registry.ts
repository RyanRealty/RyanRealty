/**
 * The Vault form registry (tc_form_registry): every form the reader has met,
 * and who must sign it. Learned from every copy read, so a new OREF or Oregon
 * REALTORS® release is picked up the first time a copy arrives and settles as
 * more copies come in (docs/TC_DOCUMENT_READER.md "The form registry").
 *
 * Forms the curated library lists keep their verified profile (basis
 * library); the registry still records their copies, and says when a new
 * release prints principal signature blocks the library does not expect.
 * Everything else is decided by form-rules.ts: law, the kind of instrument,
 * then the blocks printed across copies. A person can set a row (basis
 * person); the reader never overwrites it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveProfile, formIdentity, type DerivedProfile } from './form-rules'
import { normalizeOref, profileFor, type FormProfile, type Obligation, type Party } from './profiles'
import type { DocumentReading, FormReading } from './vision-reading'

export type RegistryEntry = {
  identity: string
  profile: FormProfile
  basis: 'library' | 'law' | 'category' | 'blocks' | 'person'
  rule: string
  confidence: 'library' | 'rule' | 'consensus' | 'new'
  copies: number
}

export type FormRegistry = {
  lookup(title: string | null | undefined): RegistryEntry | null
  readonly size: number
}

export const EMPTY_REGISTRY: FormRegistry = { lookup: () => null, size: 0 }

const PARTIES: ReadonlySet<Party> = new Set(['buyer', 'seller', 'buyer_agent', 'seller_agent', 'escrow', 'title', 'lender', 'vendor'])

type RegistryRow = {
  identity: string
  title: string
  numbers: Record<string, number> | null
  obligation: Obligation
  outcome: 'seller_response' | 'counter' | null
  numbered: boolean
  offer: boolean
  basis: RegistryEntry['basis']
  rule: string
  confidence: RegistryEntry['confidence']
  copies: number
}

function entryFromRow(r: RegistryRow): RegistryEntry {
  const numbers = Object.keys(r.numbers ?? {})
    .map((n) => normalizeOref(n))
    .filter((n): n is string => !!n)
  return {
    identity: r.identity,
    basis: r.basis,
    rule: r.rule,
    confidence: r.confidence,
    copies: r.copies,
    profile: {
      key: `registry:${r.identity}`,
      name: r.title,
      oref: [...new Set(numbers)],
      // Matched by identity, never by pattern.
      title: /$^/,
      obligation: r.obligation,
      ...(r.outcome ? { outcome: r.outcome } : {}),
      numbered: r.numbered,
      offer: r.offer,
      checklistTerms: [],
    },
  }
}

export function registryFromRows(rows: readonly RegistryRow[]): FormRegistry {
  const byIdentity = new Map(rows.map((r) => [r.identity, entryFromRow(r)]))
  return {
    lookup: (title) => {
      const id = formIdentity(title)
      return id ? byIdentity.get(id) ?? null : null
    },
    size: byIdentity.size,
  }
}

const TTL_MS = 5 * 60_000
let cached: { at: number; registry: Promise<FormRegistry> } | null = null

/** The registry, read at most every five minutes per process (a cron run reads it once). */
export function loadFormRegistry(sb: SupabaseClient, opts?: { fresh?: boolean }): Promise<FormRegistry> {
  if (!opts?.fresh && cached && Date.now() - cached.at < TTL_MS) return cached.registry
  const registry = (async () => {
    const rows: RegistryRow[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from('tc_form_registry')
        .select('identity, title, numbers, obligation, outcome, numbered, offer, basis, rule, confidence, copies')
        .range(from, from + 999)
      // No registry yet (or unreadable): the reader falls back to the curated
      // library and the lines printed on each copy, as before.
      if (error) return EMPTY_REGISTRY
      rows.push(...((data ?? []) as RegistryRow[]))
      if (!data || data.length < 1000) break
    }
    return registryFromRows(rows)
  })()
  cached = { at: Date.now(), registry }
  return registry
}

/** The parties a copy prints at least one line for (signed or not). */
export function printedPartiesOf(form: FormReading): Party[] {
  const out = new Set<Party>()
  for (const l of form.signatureLines ?? []) if (PARTIES.has(l.party as Party)) out.add(l.party as Party)
  return [...out]
}

const isPrincipal = (p: Party) => p === 'buyer' || p === 'seller'

/**
 * A new release changed the form: its copies print a principal the library
 * does not name at all, or no longer print one the library requires.
 */
function releaseDisagrees(derived: Obligation, curated: Obligation): boolean {
  if (derived.kind !== 'all' || curated.kind !== 'all') return false
  const printed = derived.parties.filter(isPrincipal)
  const named = new Set([...curated.parties, ...(curated.optional ?? [])].filter(isPrincipal))
  const required = curated.parties.filter(isPrincipal)
  return printed.some((p) => !named.has(p)) || required.some((p) => !printed.includes(p))
}

/** What the registry row says, from its copies and whatever the curated library knows. */
export function decideRow(input: {
  title: string
  copies: number
  tally: Partial<Record<Party, number>>
  topNumber: string | null
  existing: { basis: RegistryEntry['basis']; obligation: Obligation; rule: string } | null
}): {
  derived: DerivedProfile
  obligation: Obligation
  outcome: 'seller_response' | 'counter' | null
  numbered: boolean
  offer: boolean
  basis: RegistryEntry['basis']
  rule: string
  confidence: RegistryEntry['confidence']
  libraryKey: string | null
  libraryDisagrees: boolean
} {
  const derived = deriveProfile({ title: input.title, tally: input.tally, copies: input.copies })
  const match = profileFor({ title: input.title, formNumber: input.topNumber })
  const curated = match && match.basis !== 'generic' && !match.numberConflict ? match.profile : null
  if (input.existing?.basis === 'person') {
    return {
      derived,
      obligation: input.existing.obligation,
      outcome: derived.outcome ?? null,
      numbered: derived.numbered,
      offer: derived.offer,
      basis: 'person',
      rule: input.existing.rule,
      confidence: 'rule',
      libraryKey: curated?.key ?? null,
      libraryDisagrees: false,
    }
  }
  if (curated) {
    const disagrees = input.copies >= 3 && derived.basis === 'blocks' && releaseDisagrees(derived.obligation, curated.obligation)
    return {
      derived,
      obligation: curated.obligation,
      outcome: curated.outcome ?? null,
      numbered: !!curated.numbered,
      offer: !!curated.offer,
      basis: 'library',
      rule: `Curated form library: ${curated.name}.`,
      confidence: 'library',
      libraryKey: curated.key,
      libraryDisagrees: disagrees,
    }
  }
  return {
    derived,
    obligation: derived.obligation,
    outcome: derived.outcome ?? null,
    numbered: derived.numbered,
    offer: derived.offer,
    basis: derived.basis,
    rule: derived.rule,
    confidence: derived.confidence,
    libraryKey: null,
    libraryDisagrees: false,
  }
}

function topKey(counts: Record<string, number>): string | null {
  const e = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return e ? e[0] : null
}

/** Recompute one registry row from all its copies. */
export async function recomputeRegistryRow(sb: SupabaseClient, identity: string, title: string): Promise<void> {
  const copies: Array<{ parties: string[]; form_number: string | null; release: string | null; seen_at: string }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('tc_form_registry_copies')
      .select('parties, form_number, release, seen_at')
      .eq('identity', identity)
      .range(from, from + 999)
    if (error) throw new Error(`registry copies: ${error.message}`)
    copies.push(...((data ?? []) as typeof copies))
    if (!data || data.length < 1000) break
  }
  if (!copies.length) return
  const tally: Partial<Record<Party, number>> = {}
  const numbers: Record<string, number> = {}
  const releases: Record<string, number> = {}
  for (const c of copies) {
    for (const p of new Set(c.parties)) if (PARTIES.has(p as Party)) tally[p as Party] = (tally[p as Party] ?? 0) + 1
    if (c.form_number) numbers[c.form_number] = (numbers[c.form_number] ?? 0) + 1
    if (c.release) releases[c.release] = (releases[c.release] ?? 0) + 1
  }
  const { data: existing } = await sb.from('tc_form_registry').select('title, basis, obligation, rule, first_seen_at').eq('identity', identity).maybeSingle()
  const d = decideRow({
    title: (existing?.title as string | undefined) ?? title,
    copies: copies.length,
    tally,
    topNumber: topKey(numbers),
    existing: existing ? { basis: existing.basis as RegistryEntry['basis'], obligation: existing.obligation as Obligation, rule: String(existing.rule) } : null,
  })
  const seen = copies.map((c) => c.seen_at).sort()
  const { error } = await sb.from('tc_form_registry').upsert(
    {
      identity,
      title: (existing?.title as string | undefined) ?? title,
      numbers,
      releases,
      category: d.derived.category,
      obligation: d.obligation,
      outcome: d.outcome,
      numbered: d.numbered,
      offer: d.offer,
      basis: d.basis,
      rule: d.rule,
      confidence: d.confidence,
      copies: copies.length,
      party_copies: tally,
      library_key: d.libraryKey,
      library_disagrees: d.libraryDisagrees,
      first_seen_at: (existing?.first_seen_at as string | undefined) ?? seen[0],
      last_seen_at: seen[seen.length - 1],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'identity' },
  )
  if (error) throw new Error(`registry upsert: ${error.message}`)
}

/**
 * Add one read document's forms to the registry and recompute each form it
 * touched. A re-read replaces that document's copies, so nothing counts twice.
 */
export async function learnForms(
  sb: SupabaseClient,
  input: { documentId: string; reading: DocumentReading; releases?: ReadonlyArray<string | null>; defer?: boolean },
): Promise<{ forms: number; identities: Array<[string, string]> }> {
  const rows: Array<{ identity: string; document_id: string; form_index: number; parties: string[]; form_number: string | null; release: string | null }> = []
  const titles = new Map<string, string>()
  input.reading.forms.forEach((f, i) => {
    const identity = formIdentity(f.title)
    if (!identity) return
    titles.set(identity, titles.get(identity) ?? (f.title ?? '').trim())
    rows.push({
      identity,
      document_id: input.documentId,
      form_index: i,
      parties: printedPartiesOf(f),
      form_number: f.formNumber?.trim() || null,
      release: input.releases?.[f.segment] ?? null,
    })
  })
  const { error: delErr } = await sb.from('tc_form_registry_copies').delete().eq('document_id', input.documentId)
  if (delErr) throw new Error(`registry copies delete: ${delErr.message}`)
  if (rows.length) {
    const { error } = await sb.from('tc_form_registry_copies').upsert(rows, { onConflict: 'identity,document_id,form_index' })
    if (error) throw new Error(`registry copies: ${error.message}`)
  }
  if (!input.defer) for (const [identity, title] of titles) await recomputeRegistryRow(sb, identity, title)
  cached = null
  return { forms: rows.length, identities: [...titles] }
}

/** Releases per segment, from a stored reading's anatomy (OREF footer stamps). */
export function releasesFromAnatomy(anatomy: unknown): Array<string | null> {
  const segs = (anatomy as { segments?: Array<{ released?: string | null }> } | null)?.segments ?? []
  return segs.map((s) => s?.released ?? null)
}
