/**
 * Last-page signing stack when a licensed blank has no SkySlope field_map
 * and no AcroForm widgets. Broker can drag in the composer. Do not pretend
 * this is a measured overlay of every blank on the form.
 */
import { deriveSignerRole, mappedFieldTypeFromName, type MappedField, type SignerRole } from './skyslope-field-map'
import {
  demoteImplausibleSignatureFields,
  promoteInitialsBoxes,
  promoteLinedFormFields,
} from './lined-signature-fields'
import { readRequiredSigners } from './required-signers'
import type { RecipientRole } from './signing'

const ROLE_TO_SIGNER: Record<string, SignerRole> = {
  Buyer: 'buyer',
  Seller: 'seller',
  SellerAgent: 'listing_agent',
  BuyerAgent: 'buyer_agent',
}

export function fallbackSigningStack(input: {
  pageCount: number
  formNumber?: string | null
  signerProfile?: string | null
  documentName?: string | null
}): MappedField[] {
  const page = Math.max(1, Math.round(input.pageCount) || 1)
  const read = readRequiredSigners({
    formNumber: input.formNumber,
    signerProfile: input.signerProfile,
    documentName: input.documentName,
  })
  if (read.identified && !read.signatureForm) return []
  const roles = read.roles
  const signers = (roles.length ? roles : (['Seller'] as RecipientRole[])).filter((r) => ROLE_TO_SIGNER[r])
  const unique = [...new Set(signers)]
  return unique.flatMap((role, i) => {
    const signerRole = ROLE_TO_SIGNER[role]
    const y = 0.78 + i * 0.07
    return [
      {
        type: 'signature' as const,
        page,
        x: 0.12,
        y,
        w: 0.38,
        h: 0.045,
        dataRef: `${role}Signature`,
        signerRole,
        optional: false,
        label: `${role} signature`,
      },
      {
        type: 'date_signed' as const,
        page,
        x: 0.54,
        y,
        w: 0.22,
        h: 0.04,
        dataRef: `${role}DateSigned`,
        signerRole,
        optional: false,
        label: `${role} date`,
      },
    ]
  })
}

/**
 * Licensed OREF blanks often have hundreds of AcroForm text widgets and no
 * PDFSignature widgets. Name-mapping catches BuyerSignature; 001 does not
 * name those lines. Append the last-page stack for any required role that
 * still has no signature box.
 */
export function withFallbackSignatures(
  map: readonly MappedField[],
  input: {
    pageCount: number
    formNumber?: string | null
    signerProfile?: string | null
    documentName?: string | null
  },
): MappedField[] {
  const typed = demoteImplausibleSignatureFields(
    map.map((f) => ({
      ...f,
      type: mappedFieldTypeFromName(f.dataRef, f.label, f.type),
    })),
  )
  const read = readRequiredSigners({
    formNumber: input.formNumber,
    signerProfile: input.signerProfile,
    documentName: input.documentName,
  })
  const allowed = new Set<SignerRole>(
    (read.roles.length ? read.roles : (['Seller'] as RecipientRole[]))
      .map((r) => ROLE_TO_SIGNER[r])
      .filter((r): r is SignerRole => Boolean(r)),
  )
  const promoted = promoteInitialsBoxes(promoteLinedFormFields(typed), [...allowed])
  const have = new Set(promoted.filter((f) => f.type === 'signature').map((f) => f.signerRole))
  const extra = fallbackSigningStack(input).filter((f) => !have.has(f.signerRole))
  return withNoUnsignableRequirement([...promoted, ...extra], allowed)
}

/**
 * A required signature, initials, or date belonging to a role that does not
 * sign this form can never be filled — send refuses on it forever. Keep the
 * box (a broker may reassign it) but stop it holding the envelope hostage.
 */
export function withNoUnsignableRequirement(
  map: readonly MappedField[],
  allowed: ReadonlySet<SignerRole>,
): MappedField[] {
  const SIGNED = new Set(['signature', 'initials', 'date_signed'])
  return map.map((f) =>
    SIGNED.has(f.type) && f.optional !== true && !allowed.has(f.signerRole ?? null)
      ? { ...f, optional: true }
      : { ...f },
  )
}

export { deriveSignerRole }
