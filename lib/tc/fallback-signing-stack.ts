/**
 * Last-page signing stack when a licensed blank has no SkySlope field_map
 * and no AcroForm widgets. Broker can drag in the composer. Do not pretend
 * this is a measured overlay of every blank on the form.
 */
import { deriveSignerRole, type MappedField, type SignerRole } from './skyslope-field-map'
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

export { deriveSignerRole }
