/** Honest photo URL, or null when the door has none. Never invent a src. */
export function placeDoorPhotoSrc(photoSrc?: string | null): string | null {
  const url = photoSrc?.trim()
  return url || null
}
