/**
 * Last-page signing stack when a licensed blank has no SkySlope field_map
 * and no AcroForm widgets. Broker can drag in the composer. Do not pretend
 * this is a measured overlay of every blank on the form.
 */
import { deriveSignerRole, mappedFieldTypeFromName, type MappedField, type SignerRole } from './skyslope-field-map'
import {
  demoteImplausibleSignatureFields,
  labelSignatureRowsFromPage,
  promoteInitialsBoxes,
  joinRuns,
  printedRow,
  promoteLinedFormFields,
  rowLabel,
  type PageTextRun,
} from './lined-signature-fields'
import { groupAnswerRows } from './answer-rows'
import { formSigningProfile, type FormSigningProfile } from './form-signing-profile'
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
        fromStack: true,
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
        fromStack: true,
      },
    ]
  })
}

/**
 * A licensed blank's AcroForm map, ready to place: who signs each printed
 * line and initials box (the word printed beside it, lib/tc/lined-signature-fields.ts),
 * which checkbox rows answer one question (lib/tc/answer-rows.ts), and what the
 * form's instructions say about who completes it (lib/tc/form-signing-profile.ts).
 *
 * A form with no signature line of its own (text widgets only) gets the
 * last-page stack for its signers. A form that prints its own lines never
 * does: a role it has no line for either does not sign it or is placed by the
 * broker (send refuses a signer with no signature box). A stack at fixed page
 * positions put a Seller box on a printed Buyer row of the 2.15 and the 5.1.
 */
export function withFallbackSignatures(
  map: readonly MappedField[],
  input: {
    pageCount: number
    formNumber?: string | null
    signerProfile?: string | null
    documentName?: string | null
    /** The blank's page text (lib/tc/pdf-page-text.ts readPdfTextRuns); [] when it cannot be read. */
    pages?: ReadonlyArray<readonly PageTextRun[]>
  },
): MappedField[] {
  const pages = input.pages ?? []
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
  // Only roles the form is known to be signed by name a "Client" or "Broker" line; the Seller default above is a guess.
  // A version named for one side is that side's ("Advisory Regarding Lead Based Paint - Seller - 018": its
  // "Client" lines are the seller's, though the blank names them "Backup Buyer").
  const known = read.roles.map((r) => ROLE_TO_SIGNER[r]).filter((r): r is SignerRole => Boolean(r))
  const side = versionSide(input.documentName)
  const principals = side ? [side, ...known.filter((r) => r !== 'buyer' && r !== 'seller')] : known
  const profile = formSigningProfile(input.formNumber, input.documentName)
  const promoted = promoteInitialsBoxes(promoteLinedFormFields(labelSignatureRowsFromPage(typed, pages, principals)), [...allowed], pages)
  const shaped = withMustComplete(
    withProfile(groupAnswerRows(promoted, pages, { answerEveryQuestion: profile?.answerEveryQuestion }), profile),
    pages,
  )
  // A signer the form prints no line for gets the last-page stack, only where
  // it covers nothing printed: laid over the form it put a Seller box on a
  // printed Buyer row (2.15, 5.1). A role it cannot place is the broker's to
  // place; send refuses a signer with no signature box.
  // Printed lines nobody could name (a page whose text cannot be read) are
  // the signers' own lines: the broker assigns them, and no stack goes on top.
  const sigs = shaped.filter((f) => f.type === 'signature' && !f.leaveForBroker)
  const unnamed = sigs.some((f) => !f.signerRole)
  const have = new Set(sigs.map((f) => f.signerRole))
  const lastPage = Math.max(1, Math.round(input.pageCount) || 1)
  const taken = [...shaped.filter((f) => f.page === lastPage), ...(pages[lastPage - 1] ?? []).filter((r) => r.str.trim()).map(runBox)]
  const stack = unnamed ? [] : fallbackSigningStack(input).filter((f) => !have.has(f.signerRole))
  const placed = new Set(stack.filter((f) => f.type === 'signature' && fits(f, taken)).map((f) => f.signerRole))
  const extra = stack.filter((f) => placed.has(f.signerRole) && fits(f, taken))
  return withNoUnsignableRequirement([...shaped, ...extra], allowed)
}

/** The side a library version is named for: "... - Buyer - 018 OREF", "(Seller)". Null when it names both or neither. */
function versionSide(name: string | null | undefined): 'buyer' | 'seller' | null {
  const m = (name ?? '').match(/(?:\s-\s|\()\s*(Buyer|Seller)s?\s*(?:\s-\s|\))/i)
  return m ? (m[1]!.toLowerCase() as 'buyer' | 'seller') : null
}

/** A text run's box on the page: its baseline is y, its type sits above. */
function runBox(r: PageTextRun): { x: number; y: number; w: number; h: number } {
  return { x: r.x, y: r.y - 0.01, w: r.w, h: 0.01 }
}

/** A stack box fits where it covers no field or printed text and stays on the page. */
function fits(f: MappedField, taken: ReadonlyArray<{ x: number; y: number; w: number; h: number }>): boolean {
  if (f.y + f.h > 0.97) return false
  return !taken.some((t) => t.x < f.x + f.w && f.x < t.x + t.w && t.y < f.y + f.h && f.y < t.y + t.h)
}

const ROW_TYPES = new Set(['signature', 'date_signed', 'time_signed', 'full_name'])
const ANSWER_TYPES = new Set(['checkbox', 'text', 'date', 'time'])

/**
 * Apply what the form's instructions say. Signature rows outside the pages
 * this version signs, and initials outside the pages it initials, are left
 * for the broker (the 020's page 1 exclusion blocks on a disclosure that is
 * completed; the exempt 020's pages 2 to 8). The questions on the answering
 * pages go to the principal who answers them, not the broker (a box a deal
 * fact fills stays the broker's: app/actions/tc-envelopes.ts).
 */
function withProfile(map: readonly MappedField[], profile: FormSigningProfile | null): MappedField[] {
  if (!profile) return map.map((f) => ({ ...f }))
  return map.map((f) => {
    const offRow = ROW_TYPES.has(f.type) && !profile.signingPages.includes(f.page)
    const offInitials = f.type === 'initials' && !profile.initialsPages.includes(f.page)
    if (offRow || offInitials) {
      const off: MappedField = { ...f, signerRole: null, optional: true, leaveForBroker: true }
      delete off.signerIndex
      return off
    }
    const answers = profile.completedBy
    if (answers && ANSWER_TYPES.has(f.type) && answers.pages.includes(f.page) && f.y >= answers.below) {
      return { ...f, signerRole: answers.role, signerIndex: 0, signerFills: true }
    }
    return { ...f }
  })
}

const MUST_COMPLETE = /\bcomplete\s+even\s+if\s+(zero|none)\b/i

/**
 * A box its signer fills whose printed label says to complete it whatever the
 * answer ("Total number of pages attached ... (complete even if zero)", the
 * 020's line 230) is required of that signer: left blank, the disclosure does
 * not say how many pages go with it. Its printed line is the signer's prompt.
 * Of the 298 library blanks only the 020 prints this beside a box.
 */
function withMustComplete(map: readonly MappedField[], pages: ReadonlyArray<readonly PageTextRun[]>): MappedField[] {
  return map.map((f) => {
    const runs = pages[f.page - 1] ?? []
    if (!f.signerFills || f.type !== 'text' || !MUST_COMPLETE.test(rowLabel(f, runs))) return f
    // The words before the box, without the line number in the margin, up to the instruction.
    const row = joinRuns(printedRow(f, runs).filter((r) => r.x < f.x && !/^\d+$/.test(r.str.trim())))
    const prompt = /^(.*?\bcomplete\s+even\s+if\s+(?:zero|none)\b\s*\)?)/i.exec(row)?.[1]?.replace(/\s+/g, ' ').trim()
    return { ...f, mustComplete: true, ...(prompt ? { prompt } : {}) }
  })
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
