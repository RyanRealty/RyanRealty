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
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link href={`/admin/prospecting?kind=${kind}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to prospecting
        </Link>
      </Button>

      <ProspectDetailPage
        detail={detail}
        buildAction={buildProspectDoc}
        prepareSendAction={prepareProspectSend}
        sendIntroAction={sendProspectingIntro}
        sendTestAction={sendProspectTest}
        approveAction={approveProspectDoc}
      />
    </div>
  )
}
