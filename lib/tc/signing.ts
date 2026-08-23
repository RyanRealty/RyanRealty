/**
 * TC e-signature core — tokens, field geometry, shared types.
 *
 * Plain module (no 'use server'): imported by server actions AND by the
 * public signing route. Crypto helpers run server-side only.
 *
 * Geometry convention (locked here so the composer, the signing page, and the
 * sealer all agree): a field's { page, x, y, w, h } are stored as page-relative
 * FRACTIONS in [0,1], with the origin at the TOP-LEFT of the page (CSS/DOM
 * convention) — x→right, y→down. `page` is 1-indexed to match pdf.js page
 * numbers. The sealer converts to pdf-lib's bottom-left point space.
 */
import { createHash, randomBytes } from 'node:crypto'

export const SIGN_FIELD_TYPES = [
  'signature',
  'initials',
  'full_name',
  'date_signed',
  'time_signed',
  'text',
  'checkbox',
  'strike',
  'highlight',
] as const
export type SignFieldType = (typeof SIGN_FIELD_TYPES)[number]

export const SIGN_FIELD_LABEL: Record<SignFieldType, string> = {
  signature: 'Signature',
  initials: 'Initials',
  full_name: 'Full Name',
  date_signed: 'Date signed',
  time_signed: 'Time',
  text: 'Text',
  checkbox: 'Checkbox',
  strike: 'Strike',
  highlight: 'Highlight',
}

/** Sender annotations are not signer values. */
export function isSenderAnnotation(type: string | null | undefined): boolean {
  return type === 'strike' || type === 'highlight'
}

/**
 * Envelope contact roles — live SkySlope Forms File Details listbox
 * (docs/plans/tms/skyslope-pickup-20260823/ROLE_LIST.md, 2026-08-23).
 * Multiples of a role are extra recipient rows, not Buyer2/Seller2 codes.
 * Empty "None" is a Forms add-contact default, not a stored envelope role.
 */
export const RECIPIENT_ROLES = [
  'Buyer',
  'Seller',
  'EscrowOfficer',
  'TitleOfficer',
  'LoanOfficer',
  'BuyerAgent',
  'SellerAgent',
  'Broker',
  'Other',
] as const
export type RecipientRole = (typeof RECIPIENT_ROLES)[number]

/**
 * Pre-action_required stored stand-in for "Receives a copy". Not a Forms
 * contact Role. New writes store a real role + action_required = ReceivesACopy.
 */
export const COPY_ONLY_ROLE = 'cc' as const

/** Live Forms File Details / Create-envelope Action required (ROLE_LIST.md). */
export const ACTION_REQUIRED = ['NeedsToSign', 'ReceivesACopy', 'NoAction'] as const
export type ActionRequired = (typeof ACTION_REQUIRED)[number]

export const ACTION_REQUIRED_LABEL: Record<ActionRequired, string> = {
  NeedsToSign: 'Needs to sign',
  ReceivesACopy: 'Receives a copy',
  NoAction: 'No action',
}

export const RECIPIENT_ROLE_LABEL: Record<RecipientRole, string> = {
  Buyer: 'Buyer',
  Seller: 'Seller',
  EscrowOfficer: 'Escrow Officer',
  TitleOfficer: 'Title Officer',
  LoanOfficer: 'Loan Officer',
  BuyerAgent: 'Buyer Agent',
  SellerAgent: 'Seller Agent',
  Broker: 'Broker',
  Other: 'Other',
}

/** Pre-2026-08-23 stored codes → live Forms wire values. */
export const LEGACY_RECIPIENT_ROLE: Record<string, RecipientRole | typeof COPY_ONLY_ROLE> = {
  buyer: 'Buyer',
  buyer1: 'Buyer',
  buyer2: 'Buyer',
  seller: 'Seller',
  seller1: 'Seller',
  seller2: 'Seller',
  listing_broker: 'SellerAgent',
  listing_agent: 'SellerAgent',
  selling_broker: 'BuyerAgent',
  buyer_broker: 'BuyerAgent',
  escrow: 'EscrowOfficer',
  title: 'TitleOfficer',
  lender: 'LoanOfficer',
  other: 'Other',
  cc: COPY_ONLY_ROLE,
}

export function normalizeRecipientRole(role: string | null | undefined): string {
  const raw = (role ?? '').trim()
  if (!raw) return 'Other'
  if ((RECIPIENT_ROLES as readonly string[]).includes(raw) || raw === COPY_ONLY_ROLE) return raw
  return LEGACY_RECIPIENT_ROLE[raw] ?? raw
}

export function coerceRecipientPickerRole(
  role: string | null | undefined,
): RecipientRole | typeof COPY_ONLY_ROLE {
  const n = normalizeRecipientRole(role)
  if ((RECIPIENT_ROLES as readonly string[]).includes(n)) return n as RecipientRole
  if (n === COPY_ONLY_ROLE) return COPY_ONLY_ROLE
  return 'Other'
}

/** Forms Role to persist. Never write `cc` — that was the action stand-in. */
export function storedRecipientRole(role: string | null | undefined): RecipientRole {
  const n = coerceRecipientPickerRole(role)
  return n === COPY_ONLY_ROLE ? 'Other' : n
}

export function coerceActionRequired(
  action: string | null | undefined,
  role?: string | null,
): ActionRequired {
  const a = (action ?? '').trim()
  if ((ACTION_REQUIRED as readonly string[]).includes(a)) return a as ActionRequired
  if (a === 'Signer' || a === 'needs_to_sign') return 'NeedsToSign'
  if (a === 'cc' || a === 'Receives a copy' || a === 'receives_a_copy') return 'ReceivesACopy'
  if (a === 'No action' || a === 'no_action') return 'NoAction'
  if (normalizeRecipientRole(role) === COPY_ONLY_ROLE) return 'ReceivesACopy'
  return 'NeedsToSign'
}

export function recipientRoleLabel(role: string | null | undefined): string {
  const n = normalizeRecipientRole(role)
  if (n === COPY_ONLY_ROLE) return 'Receives a copy'
  return RECIPIENT_ROLE_LABEL[n as RecipientRole] ?? n
}

/** Matt (or the deal broker) on a listing file is Seller Agent; on a sale/buyer file, Buyer Agent. */
export function brokerEnvelopeRole(cycleKind: string | null | undefined): RecipientRole {
  return cycleKind === 'listing' ? 'SellerAgent' : 'BuyerAgent'
}

/** Pre-seed envelope people from cycle parties using live Forms roles. */
export function seedPartyEnvelopeRecipients(input: {
  envelopeId: string
  buyers: string[]
  sellers: string[]
  brokerName: string | null | undefined
  brokerEmail: string
  cycleKind: string | null | undefined
  brokerSigningOrder?: number
  /** When the form has been read, only these roles Need to sign. Others receive a copy. */
  requiredRoles?: readonly RecipientRole[]
}): Array<{
  envelope_id: string
  role: string
  name: string
  email: string
  signing_order: number
  action_required: ActionRequired
}> {
  const required = input.requiredRoles
  const mustSign = (role: RecipientRole): ActionRequired => {
    if (required?.length) return required.includes(role) ? 'NeedsToSign' : 'ReceivesACopy'
    // Form not identified yet — do not email the broker until the form says they sign.
    if (role === 'SellerAgent' || role === 'BuyerAgent' || role === 'Broker') return 'ReceivesACopy'
    return 'NeedsToSign'
  }
  const rows: Array<{
    envelope_id: string
    role: string
    name: string
    email: string
    signing_order: number
    action_required: ActionRequired
  }> = []
  for (const n of input.buyers) {
    if (!n?.trim()) continue
    rows.push({
      envelope_id: input.envelopeId,
      role: 'Buyer',
      name: n.trim(),
      email: '',
      signing_order: 1,
      action_required: mustSign('Buyer'),
    })
  }
  for (const n of input.sellers) {
    if (!n?.trim()) continue
    rows.push({
      envelope_id: input.envelopeId,
      role: 'Seller',
      name: n.trim(),
      email: '',
      signing_order: 2,
      action_required: mustSign('Seller'),
    })
  }
  if (input.brokerName?.trim()) {
    const brokerRole = brokerEnvelopeRole(input.cycleKind)
    rows.push({
      envelope_id: input.envelopeId,
      role: brokerRole,
      name: input.brokerName.trim(),
      email: input.brokerEmail,
      signing_order: input.brokerSigningOrder ?? 3,
      action_required: mustSign(brokerRole),
    })
  }
  return rows
}

const VENDOR_ENVELOPE_ROLE: Record<string, RecipientRole> = {
  title: 'TitleOfficer',
  escrow: 'EscrowOfficer',
  loan_officer: 'LoanOfficer',
  lender: 'LoanOfficer',
}

/** Deal-team vendors as copy recipients (Forms File Details → envelope). */
export function seedVendorEnvelopeRecipients(input: {
  envelopeId: string
  contacts: ReadonlyArray<{ role: string; name: string | null; email: string | null }>
}): Array<{
  envelope_id: string
  role: string
  name: string
  email: string
  signing_order: number
  action_required: ActionRequired
}> {
  const seen = new Set<string>()
  const rows: Array<{
    envelope_id: string
    role: string
    name: string
    email: string
    signing_order: number
    action_required: ActionRequired
  }> = []
  for (const c of input.contacts) {
    const role = VENDOR_ENVELOPE_ROLE[c.role]
    if (!role) continue
    const name = (c.name ?? '').trim()
    const email = (c.email ?? '').trim().toLowerCase()
    if (!name && !email) continue
    const key = `${role}|${email || name.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      envelope_id: input.envelopeId,
      role,
      name: name || role,
      email,
      signing_order: 4,
      action_required: 'ReceivesACopy',
    })
  }
  return rows
}

/** Fill blank recipient emails only when the CRM name is unique. */
export function applyUniquePartyEmails<T extends { name: string; email: string }>(
  rows: T[],
  people: ReadonlyArray<{ name: string | null; email: string | null }>,
): T[] {
  return rows.map((r) => {
    if (r.email?.includes('@')) return r
    const key = r.name.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!key) return r
    const hits = people.filter((p) => {
      const n = (p.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
      const e = (p.email ?? '').trim()
      return n === key && e.includes('@')
    })
    if (hits.length !== 1) return r
    return { ...r, email: String(hits[0].email).trim().toLowerCase() }
  })
}

export const ENVELOPE_STATUSES = ['draft', 'sent', 'partially_signed', 'completed', 'voided'] as const
export type EnvelopeStatus = (typeof ENVELOPE_STATUSES)[number]

export const ENVELOPE_STATUS_LABEL: Record<EnvelopeStatus, string> = {
  draft: 'Draft',
  sent: 'Out for signature',
  partially_signed: 'Partially signed',
  completed: 'Completed',
  voided: 'Voided',
}

/** A placed field as the composer/signing UI sees it. */
export type EnvelopeField = {
  id: string
  documentId: string
  recipientId: string | null
  type: SignFieldType
  page: number // 1-indexed
  x: number // fraction [0,1] from left
  y: number // fraction [0,1] from top
  w: number // fraction [0,1] of page width
  h: number // fraction [0,1] of page height
  required: boolean
  value: SignFieldValue | null
  signedAt: string | null
}

/** Stored value of a completed field (jsonb). */
export type SignFieldValue =
  | { kind: 'signature'; png: string } // data URL of drawn/typed signature
  | { kind: 'initials'; png: string }
  | { kind: 'date_signed'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'checkbox'; checked: boolean }

/**
 * Generate a per-recipient signing token. The raw token goes in the emailed
 * link; only its sha256 hash is stored (tc_envelope_recipients.auth_token_hash),
 * so a DB read can never reconstruct a live signing link.
 */
export function generateSigningToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashSigningToken(token) }
}

export function hashSigningToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Default field sizes (page fractions) when the composer drops a new field. */
export const DEFAULT_FIELD_SIZE: Record<SignFieldType, { w: number; h: number }> = {
  signature: { w: 0.22, h: 0.05 },
  initials: { w: 0.08, h: 0.045 },
  full_name: { w: 0.22, h: 0.035 },
  date_signed: { w: 0.14, h: 0.035 },
  time_signed: { w: 0.12, h: 0.035 },
  text: { w: 0.2, h: 0.035 },
  checkbox: { w: 0.03, h: 0.022 },
  strike: { w: 0.22, h: 0.018 },
  highlight: { w: 0.28, h: 0.028 },
}

/** DigiSign Edit Message. Empty custom fields keep the brokerage default. */
export function resolveSigningInviteCopy(input: {
  reminder: boolean
  propertyAddress: string
  customSubject?: string | null
  customBody?: string | null
}): { subject: string; heading: string; body: string } {
  const addr = input.propertyAddress.trim() || 'your transaction'
  const customSubject = input.customSubject?.trim() ?? ''
  const customBody = input.customBody?.trim() ?? ''
  const subject =
    customSubject ||
    (input.reminder ? `Your signature is still needed for ${addr}` : `Your signature is requested for ${addr}`)
  const heading = input.reminder ? `A reminder to sign for ${addr}` : `Your signature is requested for ${addr}`
  const body =
    customBody ||
    (input.reminder
      ? `You have documents still waiting for your signature for ${addr}.`
      : `You have documents ready to sign for ${addr}.`)
  return { subject, heading, body }
}

export function isSignableRole(
  role: string | null | undefined,
  actionRequired?: string | null,
): boolean {
  if (actionRequired != null && String(actionRequired).trim() !== '') {
    return coerceActionRequired(actionRequired, role) === 'NeedsToSign'
  }
  if (role == null || !String(role).trim()) return false
  return normalizeRecipientRole(role) !== COPY_ONLY_ROLE
}

/** Bind a form-field signer (dataRef/group) to a stored envelope recipient. */
export function recipientMatchesSigner(
  storedRole: string | null | undefined,
  signer: 'buyer' | 'seller' | 'listing_agent' | 'buyer_agent' | null,
): boolean {
  if (!signer) return false
  const n = normalizeRecipientRole(storedRole)
  if (signer === 'buyer') return n === 'Buyer'
  if (signer === 'seller') return n === 'Seller'
  if (signer === 'listing_agent') return n === 'SellerAgent'
  if (signer === 'buyer_agent') return n === 'BuyerAgent'
  return false
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function isValidEmail(email: string | null | undefined): boolean {
  return !!email && EMAIL_RE.test(email.trim())
}
