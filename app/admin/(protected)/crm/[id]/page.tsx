// @no-parity — internal admin surface, no public mockup contract
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import {
  getCrmAccess,
  getCrmEmailTemplates,
  getCrmPersonFull,
  getCrmSmsTemplates,
  getTwilioSmsStatus,
} from '@/app/actions/crm'
import { PersonWorkspaceBody } from '@/components/admin/crm/person-detail/PersonWorkspaceBody'
import { PersonWorkspaceSkeleton } from '@/components/admin/crm/person-detail/PersonWorkspaceSkeleton'

export const metadata = { title: 'Lead · Console' }
/**
 * force-dynamic tradeoff (spec-03 §5 asked to drop it):
 * CRM person pages are auth-scoped and mutation-heavy. Keeping force-dynamic
 * avoids accidental shared/cross-contact cache while identity + SendPanel still
 * paint first and secondary panels stream under nested Suspense (uncached
 * request-scoped DAL — no revalidateTag until tag invalidation is proven safe).
 */
export const dynamic = 'force-dynamic'

/**
 * Person workspace route (spec-03 W5.1).
 *
 * Identity core resolves first (auth + person + template vocabulary). Secondary
 * regions stream under Suspense via PersonWorkspaceBody → PersonWorkspace (one
 * responsive tree; mobile tabs live under person-detail/, not a route fork).
 */
export default async function ConsoleLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tpl?: string; smsTpl?: string; error?: string; flash?: string; view?: string; intent?: string }>
}) {
  const { id: idRaw } = await params
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) notFound()
  const { tpl, smsTpl, error: sendError, flash, view, intent } = await searchParams

  const [crmAccess, full, templates, smsTemplates, twilioStatus] = await Promise.all([
    getCrmAccess(),
    getCrmPersonFull(id),
    getCrmEmailTemplates(),
    getCrmSmsTemplates(),
    getTwilioSmsStatus(),
  ])
  if (!crmAccess) redirect('/admin/access-denied')
  if (!full.person) notFound()

  return (
    <Suspense fallback={<PersonWorkspaceSkeleton />}>
      <PersonWorkspaceBody
        personId={id}
        crmAccess={crmAccess}
        full={full}
        templates={templates}
        smsTemplates={smsTemplates}
        twilioStatus={twilioStatus}
        tpl={tpl}
        smsTpl={smsTpl}
        sendError={sendError}
        flash={flash}
        view={view}
        intent={intent}
      />
    </Suspense>
  )
}
