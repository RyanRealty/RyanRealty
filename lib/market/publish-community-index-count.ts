/**
 * One published active count per community on /communities.
 *
 * Featured editorial rows used geo_snapshot_mv (Tetherow 19). The A-to-Z
 * index used getCommunitiesForIndex exact-SubdivisionName tile counts
 * (Tetherow 0 / 12). Same slug, two numbers (fleet 7452bc192dba7000c82f043688697c0d).
 *
 * Snapshot wins when present (neighborhood grain for registry resorts).
 * Else the index tile count. Featured and A-Z must call this with the same
 * inputs for the same name.
 */

function asCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return Math.floor(value)
}

export function publishCommunityIndexCount(input: {
  snapshotCount?: number | null
  indexCount?: number | null
}): number {
  const snapshot = asCount(input.snapshotCount)
  if (snapshot != null) return snapshot
  const index = asCount(input.indexCount)
  if (index != null) return index
  return 0
}

export function communityIndexNameKey(name: string): string {
  return name.trim().toLowerCase()
}
