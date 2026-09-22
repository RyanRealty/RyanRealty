/** Media plate on every Browse places door — CSS `aspect-ratio` must match. */
export const HOME_PLACE_CARD_MEDIA_RATIO = '4 / 3'

/** Honest photo URL, or null when the door has none. Never invent a src. */
export function placeDoorPhotoSrc(photoSrc?: string | null): string | null {
  const url = photoSrc?.trim()
  return url || null
}
