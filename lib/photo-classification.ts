/**
 * Photo tag vocabulary for listing hero selection.
 * Live reader: app/actions/photo-classification.ts (DB-backed tags, not OpenAI).
 */

export const PHOTO_TAGS = [
  'exterior_front',
  'aerial_drone',
  'pool_outdoor_living',
  'great_room',
  'kitchen',
  'primary_suite',
  'bathroom',
  'office_flex',
  'view_mountain',
  'view_water',
  'view_forest',
  'community_amenity',
  'neighborhood_streetscape',
  'seasonal',
] as const

export type PhotoTag = (typeof PHOTO_TAGS)[number]
