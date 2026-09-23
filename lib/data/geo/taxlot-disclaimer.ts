/**
 * The one disclaimer every surface that draws a tax-lot line must print
 * beside the map (CLAUDE.md §0; see lib/data/geo/getTaxlots.ts for what the
 * data is and is not).
 *
 * Split into its own zero-import file (Matt 2026-09-23) so a CLIENT
 * component can read the string without pulling in getTaxlots.ts's server
 * DAL calls — those import lib/data/client.ts, which chains into
 * lib/supabase/server.ts (next/headers), and Next.js refuses to bundle that
 * into a 'use client' module. getTaxlots.ts re-exports this constant so
 * every existing server-side import path (`@/lib/data`,
 * `@/lib/data/geo/getTaxlots`) is unchanged.
 */
export const TAXLOT_DISCLAIMER =
  'Lot lines come from the county assessor’s tax maps. They show the recorded shape of a parcel, not a survey, and they are not a legal boundary. Order a survey before you rely on a line.'
