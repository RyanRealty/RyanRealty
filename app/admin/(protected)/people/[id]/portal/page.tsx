// @no-parity — internal admin surface, no public mockup contract
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { scopeBroker, isPersonInScope } from '@/lib/crm/scope'
import { resolvePersonAssignedBroker } from '@/lib/data/crm/leadAssignedBroker'
import { getClientPortalView } from '@/lib/data/crm/getClientPortalView'
import { VerdictLine } from '@/components/admin/v2'
import { ClientPortalReadOnlyView } from '@/components/admin/crm/portal-view/ClientPortalReadOnlyView'

export const metadata = { title: 'Portal view · Console' }

/**
 * Read-only broker mirror of a client's signed-in portal
 * (docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md, Phase 4 acceptance:
 * "Matt can open any client's view read-only from the CRM person page").
 *
 * Relocated under /admin/people/[id]/portal (Phase 11B sub-unit B1,
 * 2026-08-06) alongside the rest of the person workspace.
 * /admin/crm/[id]/portal stays alive as a redirect bridge.
 *
 * ── AUTHORIZATION ───────────────────────────────────────────────────────────
 * This route hands ONE person's private data to a DIFFERENT user, so it is
 * gated the same way every other person surface is, in-body and not only by
 * the (protected) layout: requireAdminPage('people.view') resolves the verified
 * session through getAdminContext, projects the role through the ONE capability
 * map, redirects an unauthenticated caller to sign-in with this destination
 * preserved, and redirects a signed-in caller without the capability to
 * /admin/access-denied. A non-admin cannot reach this by typing the URL.
 *
 * ── READ-ONLY ───────────────────────────────────────────────────────────────
 * There is no impersonation: the page never assumes the client's session, and
 * it never mints one. The data comes from a service-role READER
 * (getClientPortalView) whose module contains no write verb, and the rendered
 * tree contains no server action, no <form>, and no submit control. Both halves
 * are pinned by lib/data/crm/clientPortalView.test.ts.
 *
 * force-dynamic for the same reason the person workspace uses it: the read is
 * auth-scoped and per-contact, so it must never land in a shared cache.
 *
 * 11C: the page LEAD speaks the v2 admin language (ADMIN_UI.md pattern 3 —
 * answer the screen's question in one sentence first). Every figure in that
 * sentence is the length of the list rendered under the matching section
 * heading below, so the lead and the body can never disagree. The mirror
 * component itself is mounted verbatim: its read-only invariant is pinned by
 * lib/data/crm/clientPortalView.test.ts, which greps this route AND that
 * directory for 'use server', action props, <form>, and write verbs.
 */
export const dynamic = 'force-dynamic'

export default async function ClientPortalViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireAdminPage('people.view')

  const { id: idRaw } = await params
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) notFound()

  // BROKER SCOPE. requireAdminPage only asks "may this ROLE open people pages",
  // and CAPABILITY_ROLES['people.view'] includes 'broker' — so without the check
  // below, any broker could walk ids and read ANY contact's saved homes, hidden
  // homes, named areas, alert recipients and site activity. getClientPortalView
  // and all four of its downstream readers carry no scope of their own;
  // listingAlerts.ts:395 even says "No user scope — the caller is an admin action
  // gated by getCrmAccess", which is not the guard this route runs.
  //
  // Built from the capability context and the PURE decision rather than
  // app/actions/crm's requirePersonInScope, because this page is pinned
  // read-only by construction: clientPortalView.test.ts forbids importing any
  // @/app/actions/ module so a write can never sneak onto the mirror. Same
  // policy either way — scopeBroker returns null for the superuser, and
  // isPersonInScope is the same unit-tested function every CRM mutation uses.
  //
  // Fails closed: resolvePersonAssignedBroker THROWS on a read error rather than
  // reporting "no owner", and a missing row denies. notFound() rather than
  // access-denied so the response cannot be used to probe which ids exist.
  const scoped = scopeBroker({ role: ctx.role, brokerSlug: ctx.brokerSlug })
  if (scoped) {
    const owner = await resolvePersonAssignedBroker(id)
    if (!owner.found || !isPersonInScope(scoped, owner.assignedBroker)) notFound()
  }

  const view = await getClientPortalView({ crmPersonId: id })
  if (!view) notFound()

  const alerts = view.alerts.length
  const areas = view.namedAreas.length
  const saved = view.savedHomes.length
  const hidden = view.hiddenHomes.length
  const nothingSetUp = alerts + areas + saved + hidden === 0

  return (
    <>
      <div className="av2-scope" style={{ maxWidth: 896, margin: '0 auto', padding: '0 0 4px' }}>
        <VerdictLine tone={nothingSetUp ? 'attention' : 'ok'}>
          {nothingSetUp ? (
            <b>No alerts, named areas, saved homes, or hidden homes.</b>
          ) : (
            <b>
              {alerts} alert{alerts === 1 ? '' : 's'} · {areas} named area{areas === 1 ? '' : 's'} ·{' '}
              {saved} saved home{saved === 1 ? '' : 's'} · {hidden} hidden home
              {hidden === 1 ? '' : 's'}.
            </b>
          )}
        </VerdictLine>
      </div>
      <ClientPortalReadOnlyView view={view} personHref={`/admin/people/${id}`} />
    </>
  )
}
