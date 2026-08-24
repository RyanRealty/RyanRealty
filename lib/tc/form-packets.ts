export type FormPacketSeed = {
  name: string
  formNumbers?: readonly string[]
  nameIncludes?: readonly string[]
}

/**
 * Packets a broker actually uses. OREF listing/sale sets plus the Oregon Data
 * Share MLS entry and change forms from SkySlope library 1528.
 */
export const FORM_PACKET_SEEDS: readonly FormPacketSeed[] = [
  {
    name: 'Residential — Standard',
    formNumbers: ['001', '020', '042', '015'],
    nameIncludes: [
      'Advisory Regarding Electronic Funds - Buyer',
      'Advisory Regarding Electronic Funds - Seller',
    ],
  },
  {
    name: 'Listing — Standard',
    formNumbers: ['015', '042', '020'],
    nameIncludes: ['Advisory Regarding Electronic Funds - Seller'],
  },
  { name: 'ODS — MLS Entry (Residential)', nameIncludes: ['ORE Residential Input'] },
  { name: 'ODS — MLS Change', nameIncludes: ['Change Form for Status'] },
  { name: 'ODS — Exclusive Listing', nameIncludes: ['Exclusive Listing Agreement - ODS'] },
  { name: 'ODS — MLS Entry (Land)', nameIncludes: ['ORE Land Input'] },
  { name: 'ODS — MLS Entry (Farm)', nameIncludes: ['ORE Farm Input'] },
  { name: 'ODS — MLS Entry (Commercial)', nameIncludes: ['ORE Commercial Sale Input'] },
]

/** One-click buttons on the deal, not the full packet list. */
export function dealPacketNamesForKind(kind: 'listing' | 'sale' | undefined): readonly string[] {
  if (kind === 'listing') {
    return ['Listing — Standard', 'ODS — MLS Entry (Residential)', 'ODS — MLS Change']
  }
  return ['Residential — Standard']
}

export function formNameMatchesNeedle(name: string, needle: string): boolean {
  const n = name.toLowerCase()
  const k = needle.toLowerCase()
  if (!n.includes(k)) return false
  if (k === 'ore residential input' && n.includes('income')) return false
  return true
}

export function outdatedLibraryFormsMessage(
  forms: ReadonlyArray<{ name: string; pendingVersionLabel?: string | null }>,
): string | null {
  if (!forms.length) return null
  if (forms.length === 1) {
    const label = forms[0]?.pendingVersionLabel?.trim()
    const named = forms[0]?.name?.trim() || 'this form'
    return label
      ? `A newer published version of ${named} is at the source (${label}). Replace the blank on /admin/forms before sending.`
      : `A newer published version of ${named} is at the source. Replace the blank on /admin/forms before sending.`
  }
  return `${forms.length} forms on this envelope have a newer published version. Replace the blanks on /admin/forms before sending.`
}
