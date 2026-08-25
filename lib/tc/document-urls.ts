/**
 * How long a signed URL for a whole TC document stays good.
 *
 * Supabase Storage answers these with HTTP Range (206), and both the browser's
 * built-in PDF viewer and our pdf.js renderer pull the rest of the file as the
 * reader scrolls. When the token expires mid-read the later range requests come
 * back 400 InvalidJWT and the viewer silently shows a partial document — the
 * reader sees a truncated form, not an expired link. One hour outlasts reading
 * a 15-page OREF sale agreement end to end.
 *
 * Thumbnails are one small GET and do not need this.
 */
export const TC_DOCUMENT_URL_TTL_SECONDS = 3600
