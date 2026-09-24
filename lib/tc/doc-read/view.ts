/**
 * The reader's verdict as the deal page shows it. Pure.
 *
 * Reads tc_documents.classification.reader (written by run.ts) and turns it
 * into one status word and a line per form: what it is, who signed, who has
 * not. A document the current reader has not read yet returns null and the
 * page keeps its older execution label.
 */
import { READER_VERSION } from './vision-reading'

export type ReaderTone = 'ok' | 'accent' | 'slow' | 'waiting'

export type ReaderView = {
  label: string
  tone: ReaderTone
  forms: Array<{ title: string; signed: string[]; waiting: string[]; note: string | null }>
  stale: boolean
}

type StoredSigner = { party?: string; name?: string | null; signed?: boolean; signed_as?: string | null }
type StoredForm = {
  form?: string
  instance?: string | null
  counter_by?: string | null
  verdict?: string
  basis?: string
  signers?: StoredSigner[]
  reasons?: string[]
}
type StoredReader = { version?: string; verdict?: string; label?: string; forms?: StoredForm[] }

const TONE: Record<string, ReaderTone> = {
  fully_executed: 'ok',
  countered: 'accent',
  rejected: 'waiting',
  reference: 'accent',
  partially_executed: 'slow',
  unsigned: 'waiting',
  blank: 'waiting',
  needs_review: 'slow',
}

const PARTY: Record<string, string> = {
  buyer: 'buyer',
  seller: 'seller',
  buyer_agent: "buyer's agent",
  seller_agent: "seller's agent",
  escrow: 'escrow',
  title: 'title',
  lender: 'lender',
  vendor: 'vendor',
}

function who(s: StoredSigner): string {
  const role = PARTY[s.party ?? ''] ?? s.party ?? 'party'
  const name = s.name ?? s.signed_as
  return name ? `${name} (${role})` : role
}

export function readerView(classification: unknown): ReaderView | null {
  if (!classification || typeof classification !== 'object') return null
  const reader = (classification as { reader?: StoredReader }).reader
  if (!reader?.verdict) return null
  const forms = (reader.forms ?? []).map((f) => {
    const n = f.instance ? ` #${f.instance}` : ''
    const signers = f.signers ?? []
    const libraryNote = f.basis === 'lines' ? 'Not in the form library: signers read from the form itself.' : null
    const reviewNote = f.verdict === 'needs_review' ? f.reasons?.find((r) => r) ?? null : null
    return {
      title: `${f.form ?? 'Form'}${n}`,
      signed: signers.filter((s) => s.signed).map(who),
      waiting: f.verdict === 'reference' ? [] : signers.filter((s) => !s.signed).map(who),
      note: reviewNote ?? libraryNote,
    }
  })
  return {
    label: reader.label ?? reader.verdict,
    tone: TONE[reader.verdict] ?? 'waiting',
    forms,
    stale: reader.version !== READER_VERSION,
  }
}
