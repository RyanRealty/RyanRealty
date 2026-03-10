'use server'

import { trackReturnVisit as sendFubReturnVisit } from '@/lib/followupboss'

/**
 * Call when a return visit is detected (client passes user email and current page).
 * Sends FUB "Visited Website" with message "return" for tagging.
 */
export async function trackReturnVisitAction(params: {
  userEmail: string
  pageUrl: string
  pageTitle?: string
}): Promise<void> {
  await sendFubReturnVisit(params)
}
