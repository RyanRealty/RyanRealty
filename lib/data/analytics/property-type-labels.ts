/** MLS PropertyType codes → public labels (CO analytics). */
export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  A: 'Single-family / residential',
  B: 'Multi-family',
  C: 'Condos / attached',
  D: 'Land',
  E: 'Farm / ranch',
  F: 'Commercial',
  G: 'Business opportunity',
  H: 'Other',
}

export function labelPropertyType(code: string): string {
  return PROPERTY_TYPE_LABELS[code] ?? code
}
