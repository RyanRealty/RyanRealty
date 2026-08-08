'use server'

import {
  executeRefreshVideoToursCache,
  type RefreshVideoToursCacheResult,
} from '@/lib/refresh-video-tours-cache'

// NOT re-exported: this file carries 'use server', and Next emits a re-export
// from a server module as a RUNTIME binding — so `export type { X }` for a name
// that only exists as an imported TYPE compiles to a reference type-erasure
// already removed, and the module throws at evaluation. That exact line took
// /admin/crm/subscriptions to a 500 (fixed 2026-08-08). Import
// RefreshVideoToursCacheResult from '@/lib/refresh-video-tours-cache'.

/** Rebuild `video_tours_cache` (home + hub). Same logic as `/api/cron/refresh-video-tours-cache`. */
export async function getRefreshVideoToursCache(): Promise<RefreshVideoToursCacheResult> {
  return executeRefreshVideoToursCache()
}
