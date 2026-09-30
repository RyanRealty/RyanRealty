/**
 * What a form's own printed instructions say about who completes and signs
 * it, where the geometry alone cannot tell. Pure; keyed by OREF form number
 * and, where one blank serves two uses, the library version's name.
 *
 * OREF 020 Seller's Property Disclosure Statement (01/2026) carries two ways
 * to complete it on one blank:
 * - A seller claiming an exclusion printed on page 1 marks it and signs
 *   the page 1 Seller block; a buyer acknowledges the claim in the page 1
 *   Buyer block. Pages 2 to 8 are not completed.
 * - Every other seller answers the questions on pages 2 to 7, signs the
 *   page 7 Seller block, and the buyer acknowledges receipt on page 8. The
 *   page 1 blocks are not signed. Both initial the footers of pages 2 to 8.
 * The library holds both as separate versions ("... (Exempt Seller) - 020").
 * Its page 1 instructions say "Do not leave any spaces blank" and page 2
 * says "Select or fill in an answer to each question below. Select 'N/A' if
 * a question is not applicable": every Yes/No question takes exactly one box.
 */
import { parseFormNumber } from './required-signers'

export type FormSigningProfile = {
  /** The pages whose signature blocks this version signs. Blocks on other pages stay unassigned and optional. */
  signingPages: readonly number[]
  /** The pages whose footer initials this version takes. Others stay unassigned and optional. */
  initialsPages: readonly number[]
  /**
   * The principal who answers the form's questions, the pages they answer on,
   * and where the answers start on those pages (a page fraction): above it is
   * the page header, the property the broker fills.
   */
  completedBy?: { role: 'seller' | 'buyer'; pages: readonly number[]; below: number }
  /** The form says to answer every question: each Yes/No row takes exactly one box. */
  answerEveryQuestion?: boolean
}

/** The 020's header (Property Address or Tax ID #, two lines) ends above this on every page; its first question starts at 0.17. */
const HEADER_020 = 0.16

export function formSigningProfile(formNumber: string | null | undefined, name: string | null | undefined): FormSigningProfile | null {
  const form = parseFormNumber(formNumber) ?? formNumber?.trim() ?? null
  if (form === '020') {
    if (/exempt/i.test(name ?? '')) return { signingPages: [1], initialsPages: [], completedBy: { role: 'seller', pages: [1], below: HEADER_020 } }
    return {
      signingPages: [7, 8],
      initialsPages: [2, 3, 4, 5, 6, 7, 8],
      completedBy: { role: 'seller', pages: [2, 3, 4, 5, 6, 7], below: HEADER_020 },
      answerEveryQuestion: true,
    }
  }
  return null
}

/**
 * The principal who signs first in a packet: the one who completes a form in
 * it (the 020's seller). Undefined leaves the usual order, buyers first.
 */
export function principalFirst(forms: ReadonlyArray<{ formNumber?: string | null; name?: string | null }>): 'Buyer' | 'Seller' | undefined {
  for (const f of forms) {
    const role = formSigningProfile(f.formNumber, f.name)?.completedBy?.role
    if (role) return role === 'seller' ? 'Seller' : 'Buyer'
  }
  return undefined
}
