/**
 * getListingDetail — fetch a listing detail row.
 *
 * STUB: implementation lands in Wave 1 (Step 1.5) once `listing_detail_mv`
 * is created. Today returns null and logs a warning.
 *
 * Per docs/DATA_ACCESS_LAYER.md, this MUST be the only function in the
 * codebase that fetches listing detail data. Pages import this and pass
 * the result through to render.
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import type { ListingDetail } from '@/lib/data/types/listing'

const InputSchema = z.object({
  listingKey: z.string().min(1).max(100),
})

export type GetListingDetailResult = ListingDetail | null

export const getListingDetail = unstable_cache(
  async (listingKey: string): Promise<GetListingDetailResult> => {
    InputSchema.parse({ listingKey })

    // TODO(Wave 1 Step 1.5): switch to listing_detail_mv once the MV is
    // built (see docs/architecture/ADR_001_DATA_LAYER.md). For now, this
    // function returns null and logs a warning to flag any caller relying
    // on it before the MV lands.
    console.warn('[getListingDetail] STUB — listing_detail_mv not yet built. Returning null for', listingKey)

    const supabase = await supabaseServer()
    void supabase // silence unused-import warning until impl lands

    return null
  },
  ['listing-detail'],
  {
    revalidate: CACHE_WINDOWS.listingDetail,
    tags: [cacheTag.listings],
  }
)
