'use server'

/**
 * Consent-respecting bulk newsletter enrollment for the decided audience —
 * past clients + engaged leads + the westside cohort (Matt's YES 2026-07-21).
 *
 * SUPERUSER-ONLY (company-wide reach, same posture as the other bulk newsletter
 * tools in app/actions/newsletter.ts). This action is a THIN wrapper: it adds
 * superuser auth + Next cache revalidation and delegates the whole audience
 * build / consent plan / activation to executeCohortEnrollment
 * (lib/newsletter/cohort-enrollment), which the orchestration test and any
 * headless runner exercise with the same code path. The action NEVER sends an
 * issue — a real run only writes newsletter_subscribers rows through the shared
 * activation RPC; issues still go out solely through the approve-then-drain
 * send queue.
 */

import { revalidatePath } from 'next/cache'
import { getCrmAccess } from '@/app/actions/crm'
import {
  cohortEnrollmentDeps,
  executeCohortEnrollment,
  type CohortEnrollmentResult,
} from '@/lib/newsletter/cohort-enrollment'

// Re-export the result/shape types so existing importers (EnrollClient) keep a
// single import site. Type re-exports are erased at compile time, so this stays
// compatible with the 'use server' "only async function exports" rule.
export type {
  CohortSizes,
  CohortEnrollmentCounts,
  CohortSample,
  CohortEnrollmentResult,
} from '@/lib/newsletter/cohort-enrollment'

async function requireSuperuser(): Promise<{ ok: true; email: string } | { ok: false }> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') return { ok: false }
  return { ok: true, email: access.email }
}

export async function runCohortEnrollment(input: {
  dryRun?: boolean
  confirmText?: string
}): Promise<CohortEnrollmentResult> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }

  const dryRun = input.dryRun !== false
  const result = await executeCohortEnrollment(cohortEnrollmentDeps, {
    dryRun,
    confirmText: input.confirmText,
    actorEmail: gate.email,
  })

  // Only a completed real run changes what those pages render.
  if (result.ok && result.dryRun === false) {
    revalidatePath('/admin/newsletters')
    revalidatePath('/admin/newsletters/enroll')
  }
  return result
}
