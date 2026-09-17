/** Icon-only chrome trigger sits at the far right. A panel measured from
 *  that icon's left edge was ~150px on a 375 screen and sat inside the
 *  sticky header. Phone opens as a full-width sheet under the chrome. */
export function iconOnlyPanelLayout(
  viewportWidth: number,
  chromeBottom: number,
): { left: number; width: number; top: number } {
  const gutter = 12
  const width = Math.max(280, viewportWidth - gutter * 2)
  const left = gutter
  const top = Math.max(gutter, chromeBottom + 8)
  return { left, width, top }
}

export function overlayLayerZIndex(overlayClassName?: string): number {
  const match = overlayClassName?.match(/z-\[(\d+)\]/)
  if (match) return Number(match[1])
  return 50
}
