/**
 * Who must sign a form — known before send, from reading the form.
 * Field map (placed signature/initials tagged to a role) wins. Then the
 * document text / filename / OREF number against the Oregon form library.
 * Then signer_profile = mutual → Buyer + Seller.
 * Empty + unidentified means the form is not yet readable; do not invent parties.
 */
import {
  RECIPIENT_ROLE_LABEL,
  isSignableRole,
  storedRecipientRole,
  type RecipientRole,
} from './signing'
import type { SignerRole } from './skyslope-field-map'
import {
  entriesFromDocumentText,
  formLibraryEntryByNumber,
  identifyFormFromName,
  librarySignersToRoles,
  type FormLibraryEntry,
} from './form-identity'
import { signersFromHeldForm } from './library-signers-from-name'

const SIGN_TYPES = new Set(['signature', 'initials'])

export type FormSignerSource = {
  formNumber?: string | null
  signerProfile?: string | null
  fieldMap?: ReadonlyArray<{
    type?: string | null
    signerRole?: SignerRole | null
    optional?: boolean | null
  }>
  documentName?: string | null
  pageText?: string | null
  cycleKind?: string | null
}

export type SignerRead = {
  roles: RecipientRole[]
  identified: boolean
  signatureForm: boolean
}

export function parseFormNumber(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const oref = raw.trim().match(/OREF\s*[-]?\s*(\d{3}[A-Z]?)/i)
  if (oref) return oref[1].toUpperCase().replace(/[A-Z]$/, '')
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

function rolesFromEntries(
  entries: readonly FormLibraryEntry[],
  ctx: { cycleKind?: string | null; documentName?: string | null },
): SignerRead {
  if (!entries.length) return { roles: [], identified: false, signatureForm: false }
  const roles: RecipientRole[] = []
  let signatureForm = false
  for (const e of entries) {
    const mapped = librarySignersToRoles(e.signers, ctx)
    roles.push(...mapped.roles)
    if (mapped.signatureForm) signatureForm = true
  }
  return { roles: uniqueRoles(roles), identified: true, signatureForm }
}

export function requiredSignerRolesFromFormNumber(formNumber: string | null | undefined): RecipientRole[] {
  const entry = formLibraryEntryByNumber(formNumber) ?? formLibraryEntryByNumber(parseFormNumber(formNumber))
  if (!entry) return []
  return librarySignersToRoles(entry.signers, {}).roles
}

/** Field map (the document was read) first. Then page text. Then filename / OREF number. Then mutual profile. */
export function readRequiredSigners(input: FormSignerSource): SignerRead {
  const ctx = { cycleKind: input.cycleKind, documentName: input.documentName }
  const fromMap = requiredSignerRolesFromFieldMap(input.fieldMap)
  if (fromMap.length) return { roles: fromMap, identified: true, signatureForm: true }

  const fromText = rolesFromEntries(entriesFromDocumentText(input.pageText), ctx)
  if (fromText.identified) return fromText

  const fromName = identifyFormFromName(input.documentName)
  if (fromName) return rolesFromEntries([fromName], ctx)

  const fromNumber = formLibraryEntryByNumber(input.formNumber) ?? formLibraryEntryByNumber(parseFormNumber(input.formNumber))
  if (fromNumber) return rolesFromEntries([fromNumber], ctx)

  const fromHeld = signersFromHeldForm({ formNumber: input.formNumber, name: input.documentName })
  if (fromHeld) {
    return {
      ...librarySignersToRoles(fromHeld, ctx),
      identified: true,
    }
  }

  if (String(input.signerProfile ?? '').toLowerCase() === 'mutual') {
    return { roles: ['Buyer', 'Seller'], identified: true, signatureForm: true }
  }
  return { roles: [], identified: false, signatureForm: false }
}

export function requiredSignerRolesFromForm(input: FormSignerSource): RecipientRole[] {
  return readRequiredSigners(input).roles
}

export function unionRequiredSignerReads(forms: readonly FormSignerSource[]): SignerRead {
  if (!forms.length) return { roles: [], identified: false, signatureForm: false }
  const reads = forms.map(readRequiredSigners)
  return {
    roles: uniqueRoles(reads.flatMap((r) => r.roles)),
    identified: reads.every((r) => r.identified),
    signatureForm: reads.some((r) => r.signatureForm),
  }
}

export function unionRequiredSignerRoles(forms: readonly FormSignerSource[]): RecipientRole[] {
  return unionRequiredSignerReads(forms).roles
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

export const UNREAD_FORM_MESSAGE =
  'Vault has not identified this form yet, so it does not know who must sign. It will not send until the document is read. One party signing is not fully executed.'

export const NOT_SIGNATURE_FORM_MESSAGE =
  'This document is not a party-signature form. File it on the deal instead of sending for signature.'

export function sendBlockedBySignerKnowledge(
  read: SignerRead,
  recipients: ReadonlyArray<{ role: string; actionRequired?: string | null }>,
): string | null {
  if (!read.identified) return UNREAD_FORM_MESSAGE
  if (!read.signatureForm) return NOT_SIGNATURE_FORM_MESSAGE
  return missingRequiredSignersMessage(missingRequiredSignerRoles(read.roles, recipients))
}

export function inFlightEnvelopeBlocksCompletion(status: string | null | undefined): boolean {
  return status === 'sent' || status === 'partially_signed' || status === 'awaiting_other_side'
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
  if (block.status === 'awaiting_other_side') {
    return `${block.name} is waiting on the other side's signed PDF. Our signatures are not fully executed until that copy is filed.`
  }
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
    if (num && (hay.includes(num.toLowerCase()) || hay.includes(`oref ${num.toLowerCase()}`))) return true
    if (n && hay.includes(n.toLowerCase())) return true
  }
  const env = input.envelopeName.toLowerCase()
  const item = input.itemName.toLowerCase()
  if (item.length >= 12 && env.includes(item.slice(0, 24))) return true
  if (env.includes('sale agreement') && hay.includes('sale agreement')) return true
  if (env.includes('listing') && hay.includes('listing')) return true
  return false
}
