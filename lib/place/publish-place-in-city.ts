/**
 * Visitor-facing "place in city" line.
 *
 * Do not append the page city when the place string already names a city.
 * Founding case: /central-oregon/events/sunriver-music-festival printed
 * "Sunriver Resort Great Hall and Tower Theatre, Bend in Sunriver"
 * (fleet 14861a063d46a650327c0388a5f36bb5).
 */

const NAMED_CITIES = [
  'bend',
  'sunriver',
  'redmond',
  'sisters',
  'la pine',
  'terrebonne',
  'tumalo',
  'powell butte',
  'prineville',
  'madras',
  'culver',
  'metolius',
  'black butte ranch',
]

export function placeAlreadyNamesCity(place: string, city: string): boolean {
  const hay = place.trim().toLowerCase()
  const named = city.trim().toLowerCase()
  if (!hay) return false
  if (named && hay.includes(named)) return true
  const trailing = place.trim().match(/,\s*([A-Za-z][A-Za-z .'-]+)$/)
  if (!trailing) return false
  return NAMED_CITIES.includes(trailing[1].toLowerCase())
}

export function publishPlaceInCity(place: string, city: string): string {
  const p = place.trim()
  const c = city.trim()
  if (!p) return c
  if (!c) return p
  if (placeAlreadyNamesCity(p, c)) return p
  return `${p} in ${c}`
}

export function publishPlaceWithCity(place: string, city: string): string {
  const p = place.trim()
  const c = city.trim()
  if (!p) return c
  if (!c) return p
  if (placeAlreadyNamesCity(p, c)) return p
  return `${p}, ${c}`
}
