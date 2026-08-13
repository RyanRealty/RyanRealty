export const CITY_CHIPS = ['Bend', 'Redmond', 'Sisters', 'La Pine', 'Prineville', 'Sunriver'] as const

export function resolveCity(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const match = CITY_CHIPS.find((c) => c.toLowerCase() === value.trim().toLowerCase())
  return match ?? null
}

export function resolveView(raw: string | string[] | undefined): 'feed' | 'grid' {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === 'feed' ? 'feed' : 'grid'
}

export function resolveStart(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}
