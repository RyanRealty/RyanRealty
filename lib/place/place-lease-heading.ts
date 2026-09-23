/**
 * The words of a place page's lease section, in a module with no imports so a
 * client component (PlaceSubdivisionMap) can print them without pulling the
 * DAL that place-lease-stock.ts reads into the browser bundle.
 */
export const PLACE_LEASE_HEADING = 'Commercial space for lease'

/** The one page that lists every active commercial lease in Central Oregon. */
export const COMMERCIAL_LEASE_PATH = '/commercial-space-for-lease'

/** The door from a place's lease section to that page. */
export const COMMERCIAL_LEASE_ALL_LABEL = 'See all commercial space for lease'
