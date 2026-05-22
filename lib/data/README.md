# `lib/data/` — Canonical Data Access Layer

**This directory is the ONLY place that may call `supabase.from('<table>')` for the canonical domain tables.** Every page, component, action, or script outside `lib/data/` must import data access from `@/lib/data/`. Enforced by ESLint + `scripts/check-dal-boundary.mjs` in CI.

See **[docs/DATA_ACCESS_LAYER.md](../../docs/DATA_ACCESS_LAYER.md)** for the full contract.

## What lives here

- `client.ts` — Supabase server + browser clients (re-exports from `lib/supabase/`)
- `types/` — TypeScript contracts (the schema)
- `cache/` — `unstable_cache` and Redis wrappers with sane defaults
- `listings/`, `videos/`, `geo/`, `market/`, `brokers/`, `activity/`, `leads/` — domain-grouped functions
- `index.ts` — the public surface (re-exports everything callers should use)

## Pattern (every function follows)

```ts
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/data/client'
import type { ListingDetail } from '@/lib/data/types/listing'

const InputSchema = z.object({ listingKey: z.string().min(1).max(100) })

export const getListingDetail = unstable_cache(
  async (listingKey: string): Promise<ListingDetail | null> => {
    InputSchema.parse({ listingKey })
    const { data, error } = await supabaseServer
      .from('listing_detail_mv')      // MV only, never raw listings
      .select('*')
      .eq('listing_key', listingKey)
      .maybeSingle()
    if (error) { console.error('[getListingDetail]', { listingKey, error }); return null }
    return data
  },
  ['listing-detail'],
  { revalidate: 60, tags: ['listings'] }
)
```

## Adding a function

1. Define types in `types/<domain>.ts`
2. Write the function in `<domain>/<functionName>.ts`
3. Add Zod input validation
4. Wrap in `unstable_cache`
5. Write contract tests at `<domain>/__tests__/<functionName>.test.ts`
6. Export from `index.ts`
7. Update the caching table in `docs/DATA_ACCESS_LAYER.md`
