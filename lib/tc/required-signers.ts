/**
 * Who must sign a form — known before send, from reading the form.
 * Field map (placed signature/initials tagged to a role) wins. Then the OREF
 * number. Then signer_profile = mutual → Buyer + Seller.
 * Empty means the form is not yet readable; do not invent parties.
 */
import {
  RECIPIENT_ROLE_LABEL,
  isSignableRole,
  storedRecipientRole,
  type RecipientRole,
} from './signing'
import type { SignerRole } from './skyslope-field-map'

const SIGN_TYPES = new Set(['signature', 'initials'])

/** Mutual vs single-party from the Oregon matrix / form family. Not a guess. */
const ROLES_BY_FORM_NUMBER: Record<string, RecipientRole[]> = {
  '001': ['Buyer', 'Seller'],
  '015': ['Seller'],
  '020': ['Seller'],
  '040': ['Seller'],
  '041': ['Buyer'],
  '050': ['Buyer'],
  '052': ['Buyer'],
  '018': ['Buyer', 'Seller'],
  '021': ['Buyer', 'Seller'],
}

export type FormSignerSource = {
  formNumber?: string | null
  signerProfile?: string | null
  fieldMap?: ReadonlyArray<{
    type?: string | null
    signerRole?: SignerRole | null
    optional?: boolean | null
  }>
}

export function parseFormNumber(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const m = raw.trim().match(/\b(\d{3})\b/)
  return m ? m[1] : null
}

export function recipientRoleFromFieldSigner(signer: SignerRole | null | undefined): RecipientRole | null {
  if (signer === 'buyer') return 'Buyer'
  if (signer === 'seller') return 'Seller'
  if (signer === 'listing_agent') return 'SellerAgent'
  if (signer === 'buyer_agent') return 'BuyerAgent'
  return null
}

function uniqueRoles(roles: readonly RecipientRole[]): RecipientRole[] {
  const seen = new Set<RecipientRole>()
  const out: RecipientRole[] = []
  for (const r of roles) {
    if (seen.has(r)) continue
    seen.add(r)
    out.push(r)
  }
  return out
}

export function requiredSignerRolesFromFieldMap(
  fieldMap: FormSignerSource['fieldMap'],
): RecipientRole[] {
  const roles: RecipientRole[] = []
  for (const f of fieldMap ?? []) {
    if (f.optional) continue
    if (!SIGN_TYPES.has(String(f.type ?? ''))) continue
    const role = recipientRoleFromFieldSigner(f.signerRole ?? null)
    if (role) roles.push(role)
  }
  return uniqueRoles(roles)
}

export function requiredSignerRolesFromFormNumber(formNumber: string | null | undefined): RecipientRole[] {
  const n = parseFormNumber(formNumber)
  if (!n) return []
  return ROLES_BY_FORM_NUMBER[n] ?? []
}

/** Field map (the document was read) first. Then OREF number. Then mutual profile. */
export function requiredSignerRolesFromForm(input: FormSignerSource): RecipientRole[] {
  const fromMap = requiredSignerRolesFromFieldMap(input.fieldMap)
  if (fromMap.length) return fromMap
  const fromNumber = requiredSignerRolesFromFormNumber(input.formNumber)
  if (fromNumber.length) return fromNumber
  if (String(input.signerProfile ?? '').toLowerCase() === 'mutual') return ['Buyer', 'Seller']
  return []
}

export function unionRequiredSignerRoles(forms: readonly FormSignerSource[]): RecipientRole[] {
  const roles: RecipientRole[] = []
  for (const f of forms) roles.push(...requiredSignerRolesFromForm(f))
  return uniqueRoles(roles)
}

export function missingRequiredSignerRoles(
  required: readonly RecipientRole[],
  recipients: ReadonlyArray<{ role: string; actionRequired?: string | null }>,
): RecipientRole[] {
  return required.filter(
    (role) =>
      !recipients.some(
        (r) => storedRecipientRole(r.role) === role && isSignableRole(r.role, r.actionRequired),
      ),
  )
}

export function requiredSignersLabel(roles: readonly RecipientRole[]): string {
  return roles.map((r) => RECIPIENT_ROLE_LABEL[r]).join(' and ')
}

export function missingRequiredSignersMessage(missing: readonly RecipientRole[]): string | null {
  if (!missing.length) return null
  return `This document needs a ${requiredSignersLabel(missing)} signature. Add them as Needs to sign before sending. One party signing is not fully executed.`
}

export function inFlightEnvelopeBlocksCompletion(status: string | null | undefined): boolean {
  return status === 'sent' || status === 'partially_signed'
}

export function inFlightCompletionBlock(input: {
  envelopes: ReadonlyArray<{ name: string; status: string; formNumbers: readonly string[] }>
  itemName: string
  typeName: string | null
}): { name: string; status: string } | null {
  for (const env of input.envelopes) {
    if (!inFlightEnvelopeBlocksCompletion(env.status)) continue
    if (
      envelopeCoversChecklistItem({
        envelopeName: env.name,
        formNumbers: env.formNumbers,
        itemName: input.itemName,
        typeName: input.typeName,
      })
    ) {
      return { name: env.name, status: env.status }
    }
  }
  return null
}

export function inFlightCompletionMessage(block: { name: string; status: string } | null): string | null {
  if (!block) return null
  const state = block.status === 'partially_signed' ? 'Partially signed' : 'Out for signature'
  return `${block.name} is ${state.toLowerCase()}. One party signing is not fully executed. Wait until every required signer has signed.`
}

export function envelopeCoversChecklistItem(input: {
  envelopeName: string
  formNumbers: readonly string[]
  itemName: string
  typeName: string | null
}): boolean {
  const hay = `${input.itemName} ${input.typeName ?? ''}`.toLowerCase()
  for (const n of input.formNumbers) {
    const num = parseFormNumber(n)
    if (num && (hay.includes(num) || hay.includes(`oref ${num}`))) return true
  }
  const env = input.envelopeName.toLowerCase()
  const item = input.itemName.toLowerCase()
  if (item.length >= 12 && env.includes(item.slice(0, 24))) return true
  if (env.includes('sale agreement') && hay.includes('sale agreement')) return true
  if (env.includes('listing') && hay.includes('listing')) return true
  return false
}
