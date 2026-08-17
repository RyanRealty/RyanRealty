/**
 * Place-page hero photos. Curated / DB / city-fallback is fine. A stock
 * Unsplash URL (palm trees, generic interiors) is not a Central Oregon
 * place photo — drop it and use the city fallback.
 */

const STOCK_HOST = /(?:^|\.)unsplash\.com$/i
const STOCK_PATH = /\/photo-[0-9a-z-]+/i

export function isStockPlaceHeroUrl(url: string | null | undefined): boolean {
  const raw = typeof url === 'string' ? url.trim() : ''
  if (!raw) return false
  try {
    const parsed = new URL(raw)
    if (STOCK_HOST.test(parsed.hostname)) return true
    if (parsed.hostname.includes('unsplash') && STOCK_PATH.test(parsed.pathname)) return true
    return false
  } catch {
    return /unsplash\.com/i.test(raw)
  }
}

export function publishPlaceHeroUrl(
  candidates: Array<string | null | undefined>,
): string | null {
  for (const candidate of candidates) {
    const raw = typeof candidate === 'string' ? candidate.trim() : ''
    if (!raw) continue
    if (isStockPlaceHeroUrl(raw)) continue
    return raw
  }
  return null
}
