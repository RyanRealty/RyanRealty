/**
 * On-the-ground tiles for the featured community restyle.
 * Facts only: architect, acres, founded. No restaurants, HOA dollars, or routes.
 */

export type CommDGroundTile = {
  img: string
  kicker: string
  title: string
}

function asLocalPath(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? ''
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

function uniquePhotos(paths: Array<string | null | undefined>, fallback: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const path of [...paths, fallback]) {
    const clean = asLocalPath(path) ?? (path === fallback ? fallback : null)
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
  }
  return out
}

export function buildCommDGroundTiles(input: {
  heroPhoto: string
  courseImage?: string | null
  signatureHoleImage?: string | null
  architect?: string | null
  acres?: number | null
  founded?: number | string | null
}): CommDGroundTile[] {
  const photos = uniquePhotos([input.courseImage, input.signatureHoleImage, input.heroPhoto], input.heroPhoto)
  const tiles: CommDGroundTile[] = []

  const architect = input.architect?.trim() || null
  if (architect) {
    tiles.push({
      img: photos[tiles.length] ?? input.heroPhoto,
      kicker: 'The course',
      title: architect,
    })
  }

  if (input.acres != null && Number.isFinite(input.acres) && input.acres > 0) {
    tiles.push({
      img: photos[tiles.length] ?? input.heroPhoto,
      kicker: 'The land',
      title: `${Math.round(input.acres).toLocaleString('en-US')} acres`,
    })
  }

  const founded = input.founded == null ? null : String(input.founded).trim()
  if (founded) {
    tiles.push({
      img: photos[tiles.length] ?? input.heroPhoto,
      kicker: 'Opened',
      title: founded,
    })
  }

  return tiles.slice(0, 3)
}
