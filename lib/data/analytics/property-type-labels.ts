/** MLS PropertyType codes → public labels (CO analytics). */
export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  A: 'All residential',
  B: 'Manufactured in park',
  C: 'Residential income (2–4)',
  D: 'Land',
  E: 'Farm',
  F: 'Commercial sale',
  G: 'Commercial lease',
  H: 'Business opportunity',
}

export function labelPropertyType(code: string): string {
  return PROPERTY_TYPE_LABELS[code] ?? code
}
