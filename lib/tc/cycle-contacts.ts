/**
 * Pull SkySlope cycle.raw vendor contacts onto Vault deal-team rows.
 * Look-only extract. Pure. No I/O.
 */
import type { TcContactRole } from './contact-roles'

export type ExtractedDealContact = {
  role: TcContactRole
  name: string | null
  company: string | null
  email: string | null
  phone: string | null
}

type RawPerson = {
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  company?: string | null
  email?: string | null
  phoneNumber?: string | null
  alternatePhone?: string | null
}

function str(v: unknown): string | null {
  const s = v == null ? '' : String(v).trim()
  return s || null
}

function fromPerson(role: TcContactRole, c: RawPerson | null | undefined): ExtractedDealContact | null {
  if (!c || typeof c !== 'object') return null
  const name =
    str(c.fullName) ||
    [str(c.firstName), str(c.lastName)].filter(Boolean).join(' ') ||
    null
  const company = str(c.company)
  const email = str(c.email)
  const phone = str(c.phoneNumber) || str(c.alternatePhone)
  if (!name && !company && !email) return null
  return { role, name, company, email, phone }
}

const SINGLE: Array<[string, TcContactRole]> = [
  ['titleContact', 'title'],
  ['escrowContact', 'escrow'],
  ['lenderContact', 'lender'],
  ['otherSideAgentContact', 'other_agent'],
  ['homeWarrantyContact', 'home_warranty'],
  ['attorneyContact', 'attorney'],
  ['miscContact', 'misc'],
]

/** Unique vendor rows from a SkySlope sale/listing raw blob. */
export function extractContactsFromCycleRaw(raw: unknown): ExtractedDealContact[] {
  if (!raw || typeof raw !== 'object') return []
  const blob = raw as Record<string, unknown>
  const out: ExtractedDealContact[] = []
  const seen = new Set<string>()
  const push = (row: ExtractedDealContact | null) => {
    if (!row) return
    const key = `${row.role}|${(row.email ?? '').toLowerCase()}|${(row.name ?? '').toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(row)
  }
  for (const [field, role] of SINGLE) {
    push(fromPerson(role, blob[field] as RawPerson | null))
  }
  const tcs = blob.transactionCoordinators
  if (Array.isArray(tcs)) {
    for (const c of tcs) push(fromPerson('transaction_coordinator', c as RawPerson))
  }
  return out
}

export type ExtractedParty = {
  name: string
  role: 'buyer' | 'seller'
  email: string | null
  phone: string | null
}

/** Buyers/sellers from SkySlope raw (email/phone when the file had them). */
export function extractPartiesFromCycleRaw(raw: unknown): ExtractedParty[] {
  if (!raw || typeof raw !== 'object') return []
  const blob = raw as Record<string, unknown>
  const out: ExtractedParty[] = []
  const pull = (role: 'buyer' | 'seller', list: unknown) => {
    if (!Array.isArray(list)) return
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const c = item as RawPerson & { phoneNumber?: string | null }
      const name =
        str(c.fullName) || [str(c.firstName), str(c.lastName)].filter(Boolean).join(' ') || null
      if (!name) continue
      out.push({
        role,
        name,
        email: str(c.email),
        phone: str(c.phoneNumber) || str(c.alternatePhone),
      })
    }
  }
  pull('buyer', blob.buyers)
  pull('seller', blob.sellers)
  return out
}
