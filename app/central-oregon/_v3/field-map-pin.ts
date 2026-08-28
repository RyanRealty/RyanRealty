/**
 * Navy Field pin. Reads --v3-cat-0..4 and --v3-surface from the token
 * layer so Google Maps never gets a teal house icon or a rainbow.
 */

import {
  fieldPropertyTypeCat,
  presentFieldTypes,
  type FieldPropertyType,
} from '@/components/site/v3'

export function readV3TokenColor(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const probe = document.createElement('span')
  probe.style.color = `var(${token})`
  document.body.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent' ? color : fallback
}

export function fieldTypeMarkerIcon(input: {
  typeKey?: string | null
  types: readonly FieldPropertyType[]
  hover?: boolean
}): {
  path: number
  scale: number
  fillColor: string
  fillOpacity: number
  strokeColor: string
  strokeWeight: number
} {
  const cat = input.typeKey ? fieldPropertyTypeCat(input.typeKey, input.types) : 0
  const fillColor = readV3TokenColor(`--v3-cat-${cat}`, 'rgb(16, 39, 66)')
  const strokeColor = readV3TokenColor('--v3-surface', 'rgb(250, 248, 244)')
  return {
    path: typeof google !== 'undefined' ? google.maps.SymbolPath.CIRCLE : 0,
    scale: input.hover ? 7 : 5,
    fillColor,
    fillOpacity: 1,
    strokeColor,
    strokeWeight: 1.5,
  }
}

export function fieldPinLabelColor(): string {
  return readV3TokenColor('--v3-ink-on-navy', 'rgb(250, 248, 244)')
}

export function fieldTypesFromItems(
  items: ReadonlyArray<{ typeKey?: string | null; typeLabel?: string | null }>,
): FieldPropertyType[] {
  return presentFieldTypes(items)
}
