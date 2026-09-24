/**
 * Where each term on a cycle came from. Pure.
 *
 * Matt 2026-09-24, asked what happens when the executed contract says one
 * thing and the file another: "Contract wins, unless a person typed it." So
 * every writer of a term column stamps tc_cycles.term_provenance with who set
 * it, and the terms plan (./plan.ts) reads it:
 *
 *   person    a broker typed it (offer accepted, contingency days saved, deal
 *             opened with its parties). A contract that disagrees is flagged
 *             for Matt, never written over.
 *   contract  the terms reader wrote it from the executed agreement, or a
 *             person accepted the contract's value.
 *   import    the SkySlope import or its daily intake wrote it.
 *   mail      read from an email (escrow facts).
 *
 * A column with no stamp predates provenance. Every writer that a person
 * drives stamps, and the backfill (migration 20260924190000) stamped what a
 * person wrote before this existed, so no stamp means a machine wrote it.
 */

export const TERM_COLUMNS = [
  'sale_price',
  'earnest_money',
  'contract_acceptance_date',
  'escrow_closing_date',
  'inspection_days',
  'financing_days',
  'escrow_company',
  'escrow_number',
  'buyers',
  'sellers',
] as const
export type ProvenanceColumn = (typeof TERM_COLUMNS)[number]

export type ProvenanceBy = 'person' | 'contract' | 'import' | 'mail'

export type ColumnProvenance = {
  by: ProvenanceBy
  at: string
  /** The person, or the process, that wrote it. */
  actor?: string | null
  document?: string | null
  page?: number | null
  /**
   * Matt looked at the contract's value (as displayed) and kept the file's.
   * The same contract value is not flagged again; a different one is.
   */
  keptAgainst?: string | null
}

export type TermProvenance = Partial<Record<ProvenanceColumn, ColumnProvenance>>

const isColumn = (k: string): k is ProvenanceColumn => (TERM_COLUMNS as readonly string[]).includes(k)

/** Read tc_cycles.term_provenance defensively: anything unrecognized is dropped. */
export function parseProvenance(raw: unknown): TermProvenance {
  const out: TermProvenance = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isColumn(k) || !v || typeof v !== 'object') continue
    const by = (v as { by?: unknown }).by
    if (by !== 'person' && by !== 'contract' && by !== 'import' && by !== 'mail') continue
    out[k] = { ...(v as ColumnProvenance), by }
  }
  return out
}

/**
 * The provenance after `columns` were written by `by`. Only term columns are
 * stamped; a column written to null keeps no stamp. A new write clears an
 * earlier "kept against" decision, which was about the old value.
 */
export function stampProvenance(
  current: unknown,
  written: Record<string, unknown>,
  by: ProvenanceBy,
  meta: { at?: string; actor?: string | null; document?: string | null; page?: number | null } = {},
): TermProvenance {
  const next = parseProvenance(current)
  const at = meta.at ?? new Date().toISOString()
  for (const [column, value] of Object.entries(written)) {
    if (!isColumn(column)) continue
    const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0)
    if (empty) {
      delete next[column]
      continue
    }
    next[column] = { by, at, actor: meta.actor ?? null, document: meta.document ?? null, page: meta.page ?? null, keptAgainst: null }
  }
  return next
}

/** A person typed this column's current value. */
export function typedByPerson(p: TermProvenance, column: ProvenanceColumn): boolean {
  return p[column]?.by === 'person'
}

/** Matt already kept the file's value against exactly this contract value. */
export function keptAgainst(p: TermProvenance, column: ProvenanceColumn, contractDisplay: string): boolean {
  return p[column]?.keptAgainst === contractDisplay
}
