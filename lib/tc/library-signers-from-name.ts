/**
 * Who signs, for every held OREF — from the form name / number, not a five-form shortlist.
 * Guides (000) are not signature forms. Unknown names stay unidentified.
 */
import type { LibrarySigner } from './form-identity'

export function signersFromHeldForm(input: {
  formNumber?: string | null
  name?: string | null
}): LibrarySigner[] | null {
  const num = (input.formNumber ?? '').trim().toUpperCase().replace(/^OREF[- ]/, '')
  const name = (input.name ?? '').replace(/\s*\(SAMPLE.*$/i, '').toLowerCase()
  const hay = `${num} ${name}`

  if (/^000[A-C]?$/.test(num) || /guide to using|things to know|transaction terms/.test(name)) {
    return ['not_applicable']
  }
  if (/listing agreement|listing employment|early termination/.test(name) && /listing/.test(name)) {
    return ['seller', 'seller_broker']
  }
  if (/buyer representation/.test(name)) return ['buyer', 'buyer_broker']
  if (/disclosed limited agency.*sellers?/.test(name) || num === '040') return ['seller', 'seller_broker']
  if (/disclosed limited agency.*buyers?/.test(name) || num === '041') return ['buyer', 'buyer_broker']
  if (/notice from buyer|buyers? notice to seller/.test(name) || num === '109') return ['buyer']
  if (/notice from seller|sellers? notice to/.test(name) || num === '110') return ['seller']
  if (/smoke and carbon|smoke alarm/.test(name) || num === '080') return ['seller']
  if (
    /electronic funds|compensation advisory|firpta|title insurance advisory|fair housing/.test(name) ||
    ['043', '047', '092', '103', '104'].includes(num)
  ) {
    return ['single_party']
  }
  if (/initial agency disclosure|agency disclosure pamphlet/.test(name) || num === '042') {
    return ['acknowledger']
  }
  if (/unconditional disapproval/.test(name) || num === '064') return ['buyer']
  if (/referral fee/.test(name) || num === '107') return ['seller_broker']
  if (/escrow instructions/.test(name) && /buyer/.test(name)) return ['buyer']
  if (/escrow instructions/.test(name) && /seller/.test(name)) return ['seller']
  if (
    /sale agreement|addendum to sale|counteroffer|repair addendum|lead-based paint|property disclosure|termination agreement|contingency/.test(
      name,
    ) ||
    /vacant land|condominium|manufactured|new residential|farms ranches/.test(name)
  ) {
    return ['buyer', 'seller']
  }
  if (hay.trim()) {
    if (/advisory/.test(name) && !/addendum/.test(name)) return ['single_party']
    if (/addendum|agreement|disclosure|affidavit|bill of sale|option/.test(name)) return ['buyer', 'seller']
  }
  return null
}
