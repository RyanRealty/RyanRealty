export type TourListing = {
  ListingKey: string;
  ListNumber: string;
  StreetNumber: string | null;
  StreetName: string | null;
  City: string | null;
  State: string | null;
  PostalCode: string | null;
  /** Single-line USPS-style line from MLS + property record (prepare-tour only). */
  FullAddress: string;
  ListPrice: number | null;
  BedroomsTotal: number | null;
  BathroomsTotal: number | null;
  LivingAreaSqFt: number | null;
  YearBuilt: number | null;
  Latitude: number | null;
  Longitude: number | null;
  SubdivisionName?: string | null;
  StandardStatus?: string | null;
};

export type TourPhoto = {
  id: string;
  url: string;
  sortOrder: number;
  /** Relative to `public/` — e.g. `tour-cache/KEY/hero.mp4`; omit if Ken Burns only */
  i2vStaticPath?: string | null;
};

export type TourCompStats = {
  sampleSize: number;
  avgDom: number | null;
  medianPricePerSqft: number | null;
};

/**
 * On-screen hook pack — every string is composed in `prepare-tour.ts` from MLS rows only
 * (no model-generated listing claims). Remotion fallbacks only mirror the same fields.
 */
export type TourViralPack = {
  /** Opening read: full address; may contain `\n` for a deliberate second line. */
  hookLine: string;
  hookSubline: string | null;
  /** Factual pill — MLS number only (listing DOM intentionally omitted on reels). */
  badgeText?: string | null;
};

export type TourInputProps = {
  branded: boolean;
  listing: TourListing;
  /** MLS + listing_photos — hero, Act2, Act3 interiors (and Act4 tail if brollPhotos omitted or short). */
  photos: TourPhoto[];
  /**
   * Optional neighborhood / amenity stills (e.g. verified Caldera Springs stock from your picker).
   * If length ≥ 2, Act4 tail slideshow uses these URLs; MLS hero + interior acts unchanged.
   */
  brollPhotos?: TourPhoto[];
  compStats: TourCompStats;
  viral?: TourViralPack | null;
  /** Path under `public/` for staticFile(); omit or null for silent preview */
  voiceStaticPath?: string | null;
};
