/**
 * Fields the split/map search client actually renders. Viewport fetches and
 * the advanced RPC can carry extra columns (office name, extra photo URLs,
 * remarks). Serializing those for hundreds of tiles is what made
 * /homes-for-sale/bend ~771 KB of HTML.
 */
import type { ListingTileRow } from '@/app/actions/listings'

export function slimViewportListing(row: ListingTileRow): ListingTileRow {
  return {
    ListingKey: row.ListingKey,
    ListNumber: row.ListNumber ?? null,
    ListPrice: row.ListPrice,
    BedroomsTotal: row.BedroomsTotal,
    BathroomsTotal: row.BathroomsTotal,
    StreetNumber: row.StreetNumber,
    StreetName: row.StreetName,
    StreetSuffix: row.StreetSuffix ?? null,
    City: row.City,
    State: row.State ?? 'OR',
    PostalCode: row.PostalCode,
    SubdivisionName: row.SubdivisionName,
    BoundaryCity: row.BoundaryCity ?? null,
    BoundaryNeighborhood: row.BoundaryNeighborhood ?? null,
    PhotoURL: row.PhotoURL,
    Latitude: row.Latitude,
    Longitude: row.Longitude,
    StandardStatus: row.StandardStatus ?? null,
    TotalLivingAreaSqFt: row.TotalLivingAreaSqFt ?? null,
    PropertyType: row.PropertyType,
    PropertySubType: row.PropertySubType,
    OnMarketDate: row.OnMarketDate ?? null,
    CloseDate: row.CloseDate ?? null,
    has_virtual_tour: row.has_virtual_tour ?? null,
    tourUrl: row.tourUrl ?? null,
    originalListPrice: row.originalListPrice ?? null,
    price_drop_count: row.price_drop_count ?? null,
    price_drop_amount: row.price_drop_amount ?? null,
    last_price_change_timestamp: row.last_price_change_timestamp ?? null,
  }
}

export function slimViewportListings(rows: readonly ListingTileRow[]): ListingTileRow[] {
  return rows.map(slimViewportListing)
}
