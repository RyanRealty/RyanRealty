/**
 * Subject photos for the expired CMA email card.
 *
 * The letter asks for two or three pictures of the home, inside the button,
 * not a second house and not a floor plan. getListingPhotos already drops
 * floor plans and returns the MLS order. A miss leaves the card to the
 * stored hero, or to the text button when the home has no photo.
 */

export async function cmaEmailGalleryUrls(listingKey: string | null | undefined): Promise<string[]> {
  const key = (listingKey ?? '').trim()
  if (!key) return []
  try {
    const { getListingPhotos } = await import('@/lib/data/listings/getListingPhotos')
    const photos = await getListingPhotos(key)
    const out: string[] = []
    for (const photo of photos) {
      const url = (photo.url ?? '').trim()
      if (!url.startsWith('https://')) continue
      if (out.includes(url)) continue
      out.push(url)
      if (out.length === 3) break
    }
    return out
  } catch {
    return []
  }
}
