'use server'

/**
 * Refresh for the Batch Emails report.
 *
 * The button used to be a Link to `?t=<now>`, commented "appends ?t= to bust the
 * 10-min cache". It never did: getBatchEmailsReport wraps its read in
 * unstable_cache, which keys on the explicit key array, not the request URL. So
 * the control did nothing, and an operator who clicked it after a send read the
 * stale numbers as current. This revalidates the tags the reader actually
 * carries.
 */

import { revalidateTag } from 'next/cache'
import { getCrmAccess } from '@/app/actions/crm'

export async function refreshBatchEmailsAction(): Promise<void> {
  const access = await getCrmAccess()
  if (!access) return
  for (const tag of ['crm-batch-emails', 'crm-reporting', 'crm-email-reporting']) {
    revalidateTag(tag, 'max')
  }
}
