import { SUNRIVER_DESCHUTES_PHOTO } from '@/lib/geo-images'

// Resort + ranch communities we watch (approved Figma LP 4, S3).
// slugs resolve photos via communityImage() (lib/geo-images.ts — geo-verified
// curated/Area Guide photography) and live counts via geo_snapshot_mv keyed
// "city:label" (same construction as /communities). Character notes are
// established facts about each community, no superlatives, no invented stats.
export type WatchedCommunity = {
  slug: string
  label: string
  city: string
  note: string
  /** Override photo when the communityImage tier photo is not geo-correct. */
  photoOverride?: string
  photoAlt: string
}

export const WATCHED_COMMUNITIES: WatchedCommunity[] = [
  {
    slug: 'tetherow',
    label: 'Tetherow',
    city: 'Bend',
    note: 'Golf resort living on the high desert edge of west Bend.',
    photoAlt: 'Aerial view of the Tetherow golf course and homes in Bend, Oregon',
  },
  {
    slug: 'caldera-springs',
    label: 'Caldera Springs',
    city: 'Sunriver',
    note: 'Family resort community on the south end of Sunriver.',
    photoAlt: 'The engraved Caldera boulder and pond at Caldera Springs, Sunriver, Oregon',
  },
  {
    slug: 'crosswater',
    label: 'Crosswater',
    city: 'Sunriver',
    note: 'Gated golf community along the Deschutes and Little Deschutes.',
    photoAlt: 'A Crosswater golf fairway and pines near Sunriver, Oregon',
  },
  {
    slug: 'sunriver',
    label: 'Sunriver',
    city: 'Sunriver',
    note: 'The established resort community on the Deschutes, south of Bend.',
    // communityImage('sunriver') points at a night-sky cabin photo that does
    // not read as Sunriver (flagged in lib/geo-images.ts 2026-06-10). Use the
    // geo-verified Deschutes kayak photo from the asset library instead
    // (provenance documented on the constant in lib/geo-images.ts).
    photoOverride: SUNRIVER_DESCHUTES_PHOTO,
    photoAlt: 'A kayak on the Deschutes River at Sunriver, Oregon',
  },
  {
    slug: 'vandevert-ranch',
    label: 'Vandevert Ranch',
    // Registry city (data/resort-communities.json) — MLS files Vandevert under
    // Bend even though it sits just south of Sunriver.
    city: 'Bend',
    note: 'Private gated ranch community on the Little Deschutes.',
    photoAlt: 'The wooden entrance gate at Vandevert Ranch near Sunriver, Oregon',
  },
  {
    slug: 'broken-top',
    label: 'Broken Top',
    city: 'Bend',
    note: 'Gated golf community inside Bend city limits, west side.',
    photoAlt: 'The Broken Top community entrance monument in Bend, Oregon',
  },
]
