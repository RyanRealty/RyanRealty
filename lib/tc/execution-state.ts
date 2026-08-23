/**
 * Is this PDF fully executed, or does it still need our signatures?
 *
 * Email subject is a hint, not proof. SkySlope "Envelope completed" means
 * everyone ON THAT ENVELOPE signed — not both sides of the deal.
 * Fully executed = every obligated role on THIS form has a signature marker.
 */
import type { BrokerRole } from './required-documents'
import { isOtherSideRecipientRole } from './representation'
import { entriesFromDocumentText, identifyFormFromName } from './form-identity'
import { readRequiredSigners, type FormSignerSource } from './required-signers'
import type { RecipientRole } from './signing'

export type ExecutionState =
  | 'fully_executed'
  | 'needs_our_signatures'
  | 'our_side_signed'
  | 'unsigned'
  | 'not_a_signature_form'
  | 'unknown'

const SIGNATURE_MARKERS =
  /digisign\s+verified|docusign(?:ed)?|electronically\s+signed|digitally\s+signed|signed\s+by[\s:]|\/s\/\s+\w+/gi

const DIGISIGN_BLOCK =
  /digisign\s+verified[^\n]*\n+([^\n]+)(?:\n+([^\n]+))?(?:\n+([^\n]+))?/gi

export function ourObligatedRoles(
  ourRole: BrokerRole,
  required: readonly RecipientRole[],
): RecipientRole[] {
  return required.filter((r) => !isOtherSideRecipientRole(ourRole, r))
}

export function otherObligatedRoles(
  ourRole: BrokerRole,
  required: readonly RecipientRole[],
): RecipientRole[] {
  return required.filter((r) => isOtherSideRecipientRole(ourRole, r))
}

function roleFromLabel(raw: string): RecipientRole | null {
  const s = raw.trim()
  if (/^buyer\s*agent$/i.test(s) || /^selling\s*agent$/i.test(s)) return 'BuyerAgent'
  if (/^seller\s*agent$/i.test(s) || /^listing\s*agent$/i.test(s)) return 'SellerAgent'
  if (/^buyer$/i.test(s)) return 'Buyer'
  if (/^seller$/i.test(s)) return 'Seller'
  if (/^broker$/i.test(s)) return 'Broker'
  return null
}

/** Roles that actually signed, from DigiSign / DocuSign text. Overlay-only stamps may be invisible — then this is empty, not a guess. */
export function signedRolesFromPdfText(text: string | null | undefined): RecipientRole[] {
  if (!text?.trim()) return []
  const found = new Set<RecipientRole>()
  const re = new RegExp(DIGISIGN_BLOCK.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    for (const line of [m[1], m[2], m[3]]) {
      if (!line) continue
      const role = roleFromLabel(line)
      if (role) found.add(role)
    }
  }
  const near = text.match(SIGNATURE_MARKERS)
  if (near?.length && !found.size) {
    if (/\bbuyer\s*agent\b/i.test(text)) found.add('BuyerAgent')
    else if (/\bbuyer\b/i.test(text) && /signed\s+by[\s:].{0,80}buyer|\bbuyer\n/i.test(text)) found.add('Buyer')
    if (/\bseller\s*agent\b|\blisting\s*agent\b/i.test(text)) found.add('SellerAgent')
    else if (/\bseller\b/i.test(text) && /signed\s+by[\s:].{0,80}seller|\bseller\n/i.test(text)) found.add('Seller')
  }
  return [...found]
}

export function hasSignatureEvidence(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  return SIGNATURE_MARKERS.test(text)
}

function hasRole(signed: readonly RecipientRole[], role: RecipientRole): boolean {
  return signed.includes(role)
}

export function classifyExecutionState(input: {
  identified: boolean
  signatureForm: boolean
  requiredRoles: readonly RecipientRole[]
  signedRoles: readonly RecipientRole[]
  ourRole: BrokerRole
  /** 043 EFA / 042 pamphlet: one obligated party signing is complete. */
  anyPartySufficient?: boolean
}): ExecutionState {
  if (!input.identified) return 'unknown'
  if (!input.signatureForm) return 'not_a_signature_form'
  const required = input.requiredRoles
  const signed = input.signedRoles
  if (input.anyPartySufficient) {
    if (hasRole(signed, 'Buyer') || hasRole(signed, 'Seller') || required.some((r) => hasRole(signed, r))) {
      return 'fully_executed'
    }
    return signed.length ? 'unknown' : 'unsigned'
  }
  if (!required.length) return 'unknown'
  const allRequiredSigned = required.every((r) => hasRole(signed, r))
  if (allRequiredSigned) return 'fully_executed'
  const ours = ourObligatedRoles(input.ourRole, required)
  const others = otherObligatedRoles(input.ourRole, required)
  const ourDone = ours.length > 0 && ours.every((r) => hasRole(signed, r))
  const otherDone = others.length > 0 && others.every((r) => hasRole(signed, r))
  const ourMissing = ours.some((r) => !hasRole(signed, r))
  const otherMissing = others.some((r) => !hasRole(signed, r))
  if (others.length && otherDone && ourMissing) return 'needs_our_signatures'
  if (ours.length && ourDone && otherMissing) return 'our_side_signed'
  if (!signed.length) return 'unsigned'
  if (ourMissing && (otherDone || others.length === 0)) return 'needs_our_signatures'
  if (otherMissing && ourDone) return 'our_side_signed'
  return 'unknown'
}

export function classifyFromFormAndText(input: {
  form: FormSignerSource
  pageText: string
  ourRole: BrokerRole
}): ExecutionState {
  const source = { ...input.form, pageText: input.pageText }
  const read = readRequiredSigners(source)
  const entries = entriesFromDocumentText(input.pageText)
  const named = identifyFormFromName(input.form.documentName)
  const entry = entries[0] ?? named
  const anyPartySufficient = !!entry?.signers.some((s) => s === 'single_party' || s === 'acknowledger')
  return classifyExecutionState({
    identified: read.identified || anyPartySufficient,
    signatureForm: read.signatureForm || anyPartySufficient,
    requiredRoles: read.roles,
    signedRoles: signedRolesFromPdfText(input.pageText),
    ourRole: input.ourRole,
    anyPartySufficient,
  })
}

/** Mail language is a hint. Never use it to award fully_executed. */
export function executionHintFromMail(haystack: string, fromOtherSide: boolean): 'needs_our_signatures' | null {
  if (!fromOtherSide) return null
  const h = haystack.toLowerCase()
  if (/noreply@skyslope\.com/.test(h)) return null
  if (/\boffer\b/.test(h) && !/\baccepted\b/.test(h)) return 'needs_our_signatures'
  if (/\bcounter\b/.test(h)) return 'needs_our_signatures'
  return null
}

export function shouldFileAsFullyExecuted(state: ExecutionState): boolean {
  return state === 'fully_executed'
}

export const EXECUTION_STATE_LABEL: Record<ExecutionState, string> = {
  fully_executed: 'Fully executed',
  needs_our_signatures: 'Needs our signatures',
  our_side_signed: 'Our side signed',
  unsigned: 'Unsigned',
  not_a_signature_form: 'Reference',
  unknown: '',
}

export function executionStateFromClassification(raw: unknown): ExecutionState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const s = (raw as Record<string, unknown>).execution_state
  if (
    s === 'fully_executed' ||
    s === 'needs_our_signatures' ||
    s === 'our_side_signed' ||
    s === 'unsigned' ||
    s === 'not_a_signature_form'
  ) {
    return s
  }
  return null
}

export function inboundNeedsOurSignatures(state: ExecutionState, mailHint: 'needs_our_signatures' | null): boolean {
  if (state === 'needs_our_signatures') return true
  if (state === 'fully_executed' || state === 'not_a_signature_form' || state === 'our_side_signed') return false
  return mailHint === 'needs_our_signatures'
}
