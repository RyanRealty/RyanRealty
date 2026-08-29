/**
 * Floor-plan stills this listing actually has.
 *
 * Spark stores them on `details.FloorPlans` (Uri / Uri300). A still whose
 * caption or classification names a floor plan also counts. Do not invent a
 * plan from FloorPlansCount alone — 1415 Elgin reports count 1 with an
 * empty array and no URI.
 */

export type ListingFloorPlanStill = {
  url: string
  caption: string | null
  order: number
}

export type SparkFloorPlanRow = {
  Uri?: string | null
  Uri300?: string | null
  Uri640?: string | null
  UriLarge?: string | null
  Caption?: string | null
  Name?: string | null
}

function pickFloorPlanUri(row: SparkFloorPlanRow): string | null {
  const url = row.Uri ?? row.UriLarge ?? row.Uri640 ?? row.Uri300 ?? null
  if (!url?.trim()) return null
  return url.trim()
}

export function isListingFloorPlanCaption(
  caption: string | null | undefined,
  classification?: string | null,
): boolean {
  const blob = `${caption ?? ''} ${classification ?? ''}`.toLowerCase()
  return /floor[\s_-]*plans?/.test(blob)
}

export function publishListingFloorPlans(input: {
  sparkFloorPlans?: ReadonlyArray<SparkFloorPlanRow | null | undefined> | null
  photos?: ReadonlyArray<{
    url: string
    caption?: string | null
    classification?: string | null
    order?: number
  }> | null
}): ListingFloorPlanStill[] {
  const out: ListingFloorPlanStill[] = []
  const seen = new Set<string>()

  const push = (url: string, caption: string | null, order: number) => {
    if (seen.has(url)) return
    seen.add(url)
    out.push({ url, caption, order })
  }

  const spark = input.sparkFloorPlans ?? []
  for (let i = 0; i < spark.length; i++) {
    const row = spark[i]
    if (!row) continue
    const url = pickFloorPlanUri(row)
    if (!url) continue
    const caption = (row.Caption ?? row.Name ?? '').trim() || null
    push(url, caption, i)
  }

  for (const photo of input.photos ?? []) {
    if (!isListingFloorPlanCaption(photo.caption, photo.classification)) continue
    if (!photo.url?.trim()) continue
    push(photo.url.trim(), photo.caption ?? null, photo.order ?? out.length)
  }

  return out
}
