/**
 * Shared dimensions for listing, city, and community tiles in sliders and grids.
 * Use these so all tiles have the same width/height and consistent like/share placement.
 * Site-wide rule: sliders never show more than 3 cards at a time (1 mobile, 2 sm, 3 lg+).
 */

/** Width of each tile in horizontal sliders (listing, community). Used for fixed-width contexts. */
export const SLIDER_TILE_WIDTH_PX = 300

/** Min height for tile cards so rows align when content length varies. */
export const TILE_MIN_HEIGHT_PX = 360

/** Aspect ratio for tile media (photo/banner) when we want consistent height. */
export const TILE_MEDIA_ASPECT = 4 / 3
