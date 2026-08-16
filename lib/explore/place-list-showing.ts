/** Null when the list already is the counted set. */
export function placeListShowingLabel(shown: number, totalActive: number): string | null {
  if (shown <= 0 || totalActive <= shown) return null
  return `Showing ${shown.toLocaleString('en-US')} of ${totalActive.toLocaleString('en-US')} homes`
}
