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
 *   mls       the MLS shows the cycle's own sale closed (lib/tc/mls-close.ts).
 *             Only the close columns carry it.
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
export type TermColumnName = (typeof TERM_COLUMNS)[number]

/**
 * A cycle's close: its status and actual closing date. Stamped only by the
 * MLS close rule (lib/tc/mls-close.ts, stampCloseProvenance), never by
 * stampProvenance, so the other writers keep stamping only terms. Kept by
 * parseProvenance so a later term write never drops the MLS stamp, and read by
 * the SkySlope intake: a close the MLS recorded is the Vault's, not the import's.
 */
export const CLOSE_COLUMNS = ['status', 'actual_closing_date'] as const
export type CloseColumn = (typeof CLOSE_COLUMNS)[number]

export type ProvenanceColumn = TermColumnName | CloseColumn

export type ProvenanceBy = 'person' | 'contract' | 'import' | 'mail' | 'mls'

/** The MLS facts a close stamped by 'mls' rests on. */
export type MlsCloseSource = { listNumber: string; closeDate: string; closePrice: number | null }

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
  /** Set on a close stamped by 'mls': the MLS row it came from. */
  mls?: MlsCloseSource | null
}

export type TermProvenance = Partial<Record<ProvenanceColumn, ColumnProvenance>>

const isColumn = (k: string): k is TermColumnName => (TERM_COLUMNS as readonly string[]).includes(k)
const isCloseColumn = (k: string): k is CloseColumn => (CLOSE_COLUMNS as readonly string[]).includes(k)
const BY: readonly ProvenanceBy[] = ['person', 'contract', 'import', 'mail', 'mls']

/** Read tc_cycles.term_provenance defensively: anything unrecognized is dropped. */
export function parseProvenance(raw: unknown): TermProvenance {
  const out: TermProvenance = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if ((!isColumn(k) && !isCloseColumn(k)) || !v || typeof v !== 'object') continue
    const by = (v as { by?: unknown }).by
    if (!BY.includes(by as ProvenanceBy)) continue
    out[k] = { ...(v as ColumnProvenance), by: by as ProvenanceBy }
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

/**
 * The provenance after the MLS close rule wrote a cycle's close columns. Only
 * the close columns are stamped; everything else is kept as it was.
 */
export function stampCloseProvenance(
  current: unknown,
  written: Partial<Record<CloseColumn, unknown>>,
  meta: { at?: string; actor?: string | null; mls: MlsCloseSource },
): TermProvenance {
  const next = parseProvenance(current)
  const at = meta.at ?? new Date().toISOString()
  for (const [column, value] of Object.entries(written)) {
    if (!isCloseColumn(column) || value == null || value === '') continue
    next[column] = { by: 'mls', at, actor: meta.actor ?? null, document: null, page: null, keptAgainst: null, mls: meta.mls }
  }
  return next
}

/** The MLS recorded this close column's current value (see CLOSE_COLUMNS). */
export function closedByMls(p: TermProvenance, column: CloseColumn): boolean {
  return p[column]?.by === 'mls'
}

/** A person typed this column's current value. */
export function typedByPerson(p: TermProvenance, column: ProvenanceColumn): boolean {
  return p[column]?.by === 'person'
}

/** Matt already kept the file's value against exactly this contract value. */
export function keptAgainst(p: TermProvenance, column: ProvenanceColumn, contractDisplay: string): boolean {
  return p[column]?.keptAgainst === contractDisplay
}
