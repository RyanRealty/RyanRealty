/** Pure helpers for listing-file actions (SkySlope Manage Listings kebab). */

export function duplicatePropertyKey(key: string): string {
  const base = key.replace(/-copy(?:-\d+)?$/, '')
  return `${base}-copy`
}

export function nextDuplicatePropertyKey(existing: readonly string[], sourceKey: string): string {
  const base = sourceKey.replace(/-copy(?:-\d+)?$/, '')
  const taken = new Set(existing)
  const first = `${base}-copy`
  if (!taken.has(first)) return first
  for (let n = 2; n < 100; n++) {
    const k = `${base}-copy-${n}`
    if (!taken.has(k)) return k
  }
  return `${base}-copy-${Date.now()}`
}

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}
