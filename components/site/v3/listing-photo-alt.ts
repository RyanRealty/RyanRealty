import { containsEmailAddress } from '@/lib/listing/listing-media-url'

/**
 * listingPhotoAlt — the one place a listing-photo `alt` string is built.
 *
 * A photo carries a property in image search and AI answer engines only when
 * it says which home it is: address, plus city/state when the row has one.
 * `cityLine` is empty or whitespace on some rows (land parcels, incomplete
 * geocodes) — fall back to the address alone rather than publish a trailing
 * comma. Pure and side-effect-free so every caller (V3ListingRow,
 * SplitCardMedia, listing gallery frames, alerts thumbs, ledger thumbs)
 * shares one definition instead of re-deriving the string inline.
 */
export function listingPhotoAlt({
  addressLine,
  cityLine,
}: {
  addressLine: string
  cityLine?: string | null
}): string {
  const address = addressLine.trim()
  const city = (cityLine ?? '').trim()
  if (!address) return city
  return city ? `${address}, ${city}` : address
}

/** Longest caption printed; past this it is remarks, not a caption. */
const PHOTO_CAPTION_MAX = 200
/** A North American phone number in any of the usual spellings. */
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/
const URL_RE = /\bhttps?:\/\/|\bwww\./i
/** A camera or upload file name ("IMG_4021.jpg", "DSC0193", "photo 12"). */
const FILE_NAME_RE = /\.(?:jpe?g|png|heic|webp|gif|tiff?)$|^(?:img|dsc|dscn|dji|pxl|photo|image)[\s_-]?\d+$/i

/**
 * The MLS photo caption as the listing broker wrote it, or null when it may
 * not be printed (2026-10-14). Whitespace runs collapse to one space; no word
 * is changed. Blank, file-name and number-only captions say nothing, so they
 * fall back to the address. A caption carrying an email address, a phone
 * number or a link is withheld whole: another brokerage's contact never
 * prints on a home that is not ours (Matt 2026-09-22), and a caption is never
 * edited to remove it. Pure.
 */
export function publishListingPhotoCaption(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const caption = raw.replace(/\s+/g, ' ').trim()
  if (caption.length < 2 || caption.length > PHOTO_CAPTION_MAX) return null
  if (!/[a-z]/i.test(caption)) return null
  if (FILE_NAME_RE.test(caption)) return null
  if (containsEmailAddress(caption) || PHONE_RE.test(caption) || URL_RE.test(caption)) return null
  return caption
}

/**
 * listingGalleryFrameAlt — address + ordinal for every listing-gallery still,
 * led by the MLS photo caption when the listing broker wrote one.
 *
 * Site audit 2026-09-18: a Bend PDP shipped ~54/56 `alt=""` because the
 * filmstrip thumbs were decorative and the carousel only named the one
 * mounted plate. Image search and a screen reader both need the house and
 * which plate this is. Caption is ignored when blank (MLS often stores "")
 * so it cannot wipe the address.
 *
 * 2026-10-14: a printable caption (publishListingPhotoCaption) leads, as
 * written, and the address sentence follows it, so the alt says what the
 * picture shows AND which home it is: "Kitchen with quartz island. 2750 NE
 * Great Horned Place, Bend, OR, photo 3 of 54".
 */
export function listingGalleryFrameAlt({
  addressLine,
  cityLine,
  ordinal,
  total,
  caption,
}: {
  addressLine?: string | null
  cityLine?: string | null
  ordinal: number
  total: number
  caption?: string | null
}): string {
  const named = listingPhotoAlt({
    addressLine: addressLine ?? '',
    cityLine,
  })
  const n = Number.isFinite(ordinal) ? Math.max(1, Math.trunc(ordinal)) : 1
  const of = Number.isFinite(total) ? Math.max(n, Math.trunc(total)) : n
  const slot = `photo ${n} of ${of}`
  const where = named ? `${named}, ${slot}` : `Listing ${slot}`
  const said = publishListingPhotoCaption(caption)
  if (!said) return where
  return `${said}${/[.!?]$/.test(said) ? '' : '.'} ${where}`
}
