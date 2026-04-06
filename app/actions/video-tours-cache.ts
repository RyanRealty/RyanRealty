'use server'

import {
  executeRefreshVideoToursCache,
  type RefreshVideoToursCacheResult,
} from '@/lib/refresh-video-tours-cache'

export type { RefreshVideoToursCacheResult }

/** Rebuild `video_tours_cache` (home + hub). Same logic as `/api/cron/refresh-video-tours-cache`. */
export async function getRefreshVideoToursCache(): Promise<RefreshVideoToursCacheResult> {
  return executeRefreshVideoToursCache()
}
