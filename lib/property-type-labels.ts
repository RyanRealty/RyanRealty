/**
 * MLS / RESO-style property type codes to human-readable labels.
 * Covers common residential types from Central Oregon MLS and RESO standards.
 */
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  SFR: 'Single Family Residential',
  RES: 'Residential',
  SFD: 'Single Family Detached',
  DET: 'Detached',
  CONDO: 'Condominium',
  CON: 'Condominium',
  TWNHS: 'Townhouse',
  TH: 'Townhouse',
  TOWN: 'Townhouse',
  MFR: 'Multi-Family',
  DPLX: 'Duplex',
  TPLX: 'Triplex',
  QUAD: 'Quadplex',
  APT: 'Apartment',
  LOFT: 'Loft',
  CABIN: 'Cabin',
  COOP: 'Cooperative',
  COMRES: 'Commercial/Residential',
  MF: 'Multi-Family',
  MFD: 'Manufactured',
  MH: 'Manufactured Home',
  MHP: 'Manufactured Home (Park)',
  RANCH: 'Ranch',
  FARM: 'Farm',
  LAND: 'Land',
  ACRE: 'Acreage',
  COMM: 'Commercial',
  IND: 'Industrial',
  INDM: 'Industrial/Mixed',
  MIX: 'Mixed Use',
  MOB: 'Mobile Home',
  // Numeric or alternate codes some MLS use
  '433': 'Manufactured Home',
  '434': 'Mobile Home',
}

/**
 * Returns a human-readable label for an MLS property type code.
 * Falls back to title-casing the code if unknown.
 */
export function getPropertyTypeLabel(code: string | null | undefined): string {
  const c = (code ?? '').trim()
  if (!c) return '—'
  const upper = c.toUpperCase()
  if (PROPERTY_TYPE_LABELS[upper]) return PROPERTY_TYPE_LABELS[upper]
  // Title-case unknown codes (e.g. "Residential" from "RESIDENTIAL")
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
}
