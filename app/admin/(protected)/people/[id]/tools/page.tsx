// @no-parity — internal admin surface, no public mockup contract
import { Suspense } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  getCrmAccess,
  getCrmEmailTemplates,
  getCrmPersonFull,
  getCrmSmsTemplates,
  getTwilioSmsStatus,
} from '@/app/actions/crm'
import { getPersonIdByLegacyId } from '@/lib/data/crm/getPersonIdByLegacyId'
import { resolveDisplayName } from '@/app/admin/(protected)/crm/[id]/person-view-model'
import { EntityTitle } from '@/components/admin/v2'
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
 * Relocated under /admin/people/[id]/tools (Phase 11B sub-unit B1,
 * 2026-08-06): the legacy Lead Command Center is now one tap under the v2
 * person page instead of owning the primary person route. /admin/crm/[id]
 * stays alive as a redirect bridge for old bookmarks and links (see that
 * file). This route also resolves LEGACY ids the same way
 * /admin/people/[id] does: an id that doesn't resolve to a live person falls
 * back to the legacy-id map before 404ing.
 *
 * Identity core resolves first (auth + person + template vocabulary). Secondary
 * regions stream under Suspense via PersonWorkspaceBody → PersonWorkspace (one
 * responsive tree; mobile tabs live under person-detail/, not a route fork).
 *
 * 11C: the page CHROME speaks the v2 admin language (ADMIN_UI.md); the
 * workspace tree below is mounted verbatim and migrates with its own family.
 * MUST NOT BREAK: ci:person-workspace-single-tree pins Suspense +
 * PersonWorkspaceBody + PersonWorkspaceSkeleton in this file and forbids an
 * md: fork here. Broker scope is carried by getCrmPersonFull's own RBAC
 * self-guard (an out-of-scope contact returns the empty bundle → notFound).
 */
export default async function PersonWorkspaceToolsPage({
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
  if (!full.person) {
    // Legacy-id fallback — same map /admin/people/[id] uses so pre-2026-07-09
    // bookmarks into the workspace keep working from this door too.
    const mapped = await getPersonIdByLegacyId(id)
    if (mapped) redirect(`/admin/people/${mapped}/tools`)
    notFound()
  }

  return (
    <>
      <div className="av2-scope" style={{ padding: '12px 16px 0' }}>
        <div className="av2-wordrow" style={{ marginBottom: 6 }}>
          <Link
            href={`/admin/people/${id}`}
            className="av2-btn av2-btn--quiet"
            style={{ textDecoration: 'none' }}
          >
            Person
          </Link>
        </div>
        {/* The workspace tree below carries no h1 (PersonSidebar's name is an
            h2), so the entity's own name is the heading here — the one h1
            ADMIN_UI rule 1 allows on an entity page. */}
        <EntityTitle>{resolveDisplayName(full.person.name, id)} · all tools</EntityTitle>
      </div>
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
    </>
  )
}
