/**
 * The one publisher for a recorded subdivision's display name, re-exported
 * under the Atlas's own name so page files that pin their visitor
 * vocabulary (the neighborhood page bans the county-recorder word for a
 * subdivision anywhere in its source) can still use it.
 */
export { publishPlatDisplayName as publishRegionName } from '@/lib/market/publish-plat-display-name'
