// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/prospecting/<kind>/<id> — the prospect's OWN page.
 *
 * Matt, Brain Dump 2: "When I click on the address itself, it should take me
 * directly to a full detail page that will give me the full breakdown of the
 * expired listing information." The `?id=` drawer this replaces opened a panel
 * that could not be linked to, printed, or opened in a second tab.
 *
 * Everything the drawer rendered lives here — identity, property facts, the
 * listing history, the audit's recommended price, engagement, drip state — plus
 * Build / Approve / Send, so the whole loop closes without going back to the
 * list.
 *
 * P11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
 * pattern 5 (entity page: identity header, then the stacked context sections).
 *
 * Carried over verbatim: requireAdminPage('prospecting.view'), the awaited
 * `params` Promise and BOTH values off it, the kind allow-list → notFound(),
 * decodeURIComponent(idRaw), getProspectDetail(kind, id) → notFound() on null,
 * `dynamic = 'force-dynamic'`, `maxDuration = 300` for the inline CMA build,
 * the /admin/prospecting?kind= back href, and all five server actions handed to
 * ProspectDetailPage unchanged.
 *
 * Shape changed, data did not: the shadcn ghost back-button became the quiet
 * v2 back link the rest of the admin uses, and the page gained the identity
 * header pattern 5 asks for — the address, which is the thing Matt clicked to
 * get here. The island's own <h2> is the OWNER's name, a different fact, so
 * this is a header and not a second copy of the same string.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getProspectDetail } from '@/lib/data'
import type { ProspectKind } from '@/lib/data/prospecting/types'
import {
  approveProspectDoc,
  buildProspectDoc,
  prepareProspectSend,
  sendProspectingIntro,
  sendProspectTest,
} from '@/app/actions/prospecting'
import { EntityTitle } from '@/components/admin/v2'
import { ProspectDetailPage } from '@/components/admin/prospecting/ProspectDetailPage.client'

export const dynamic = 'force-dynamic'
// The inline "Build audit" runs the deterministic CMA builder (~30-60s).
export const maxDuration = 300

export default async function ProspectDetailRoute({
  params,
}: {
  params: Promise<{ kind: string; id: string }>
}) {
  await requireAdminPage('prospecting.view')
  const { kind: kindRaw, id: idRaw } = await params
  if (kindRaw !== 'expired' && kindRaw !== 'fsbo') notFound()
  const kind = kindRaw as ProspectKind
  const id = decodeURIComponent(idRaw)

  const detail = await getProspectDetail(kind, id)
  if (!detail) notFound()

  const address =
    detail.fullAddress ??
    [detail.streetAddress, detail.city, detail.postalCode].filter(Boolean).join(', ')

  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <nav aria-label="Breadcrumb" style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link
          href={`/admin/prospecting?kind=${kind}`}
          style={{ color: 'var(--a-accent)', textDecoration: 'none' }}
        >
          Prospecting
        </Link>
      </nav>

      <EntityTitle>{address || 'Address unknown'}</EntityTitle>

      <div style={{ marginTop: 16 }}>
        <ProspectDetailPage
          detail={detail}
          buildAction={buildProspectDoc}
          prepareSendAction={prepareProspectSend}
          sendIntroAction={sendProspectingIntro}
          sendTestAction={sendProspectTest}
          approveAction={approveProspectDoc}
        />
      </div>
    </div>
  )
}
