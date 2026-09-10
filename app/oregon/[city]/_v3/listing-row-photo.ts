/**
 * SITE-61. The Spark size rewrite lives at lib/listing/row-photo.ts now that
 * more than one listing-shaped ledger uses it. This path stays so the oregon-
 * city tests and page keep importing the name they already had.
 */
export { listingRowPhotoSrc } from '@/lib/listing/row-photo'
