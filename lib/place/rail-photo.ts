/**
 * The first listing photograph for a subdivision rail row.
 * A row with no keyed home, or homes with no photograph, gets null.
 * Never borrows a picture from a different subdivision.
 */
export function firstListedPhoto(
  homes: readonly { listingKey: string; photoUrl?: string | null }[],
  keys: readonly string[] | undefined,
): string | null {
  if (!keys?.length) return null
  const wanted = new Set(keys)
  for (const home of homes) {
    if (!wanted.has(home.listingKey)) continue
    const photo = home.photoUrl?.trim()
    if (photo) return photo
  }
  return null
}
