'use server'

/**
 * Client-pollable read of a CRM bulk job (Wave 3).
 *
 * getCrmBulkJob / getRecentCrmBulkJobs in lib/data/crm/getCrmBulkJob.ts are
 * `server-only`, so the client bulk bar cannot import them directly to poll
 * progress. This thin server action is the bridge: it gates on CRM access, then
 * delegates to the DAL reader. The reader is intentionally uncached (a job is a
 * live, fast-moving row), so polling this every couple of seconds gives the bar
 * an honest progress bar.
 *
 * Scope: an authenticated CRM user may read any job they can name by id (the id
 * is only handed back to the same session that enqueued it). The recent-jobs
 * list is scoped to the caller's own runs for a restricted broker, and shows all
 * runs for a superuser, mirroring getRecentCrmBulkJobs' actorEmail argument.
 */

import { getCrmAccess } from '@/app/actions/crm'
import {
  getCrmBulkJob,
  type CrmBulkJobView,
} from '@/lib/data/crm/getCrmBulkJob'

/** Poll one bulk job for the progress bar. Returns null when unauthorized or gone. */
export async function fetchBulkJobStatus(jobId: number): Promise<CrmBulkJobView | null> {
  const access = await getCrmAccess()
  if (!access) return null
  const id = Number(jobId)
  if (!Number.isFinite(id) || id <= 0) return null
  return getCrmBulkJob(id)
}
