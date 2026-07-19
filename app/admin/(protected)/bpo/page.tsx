// @no-parity — internal admin surface, no public mockup contract.
/**
 * /admin/bpo — the Broker Price Opinion worklist. The Buyer Price-Opinion
 * sibling of /admin/prospecting: a KPI strip + filterable card grid + `?id=`
 * detail drawer + guarded send dialog over `broker_price_opinions`, replacing
 * the old raw table index. The canonical per-opinion review/rebuild/finalize
 * surface stays at /admin/bpo/[slug] (linked from every card) — this page is
 * the fast triage worklist on top of it.
 */

import { requireAdminPage } from '@/lib/admin/require-admin'
import { listBposForAdmin, getBpoWorklistRowById } from '@/lib/data/bpo/reads'
import type { BpoPosture, BpoStatusFilter, BpoWorklistFilters } from '@/lib/data/bpo/reads'
import { finalizeBpoAction } from '@/app/actions/bpo-admin'
import { prepareBpoSendPreviewAction, sendBpoForContactAction, sendBpoTestAction } from '@/app/actions/contact-bpo'
import { BpoBoard } from '@/components/admin/bpo/worklist/BpoBoard.client'

export const dynamic = 'force-dynamic'

const STATUSES: BpoStatusFilter[] = ['all', 'draft', 'final', 'archived']

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  const t = s?.trim()
  return t || undefined
}

export default async function AdminBpoWorklistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage('prospecting.view')

  const sp = await searchParams

  const posture: BpoPosture = str(sp.posture) === 'seller' ? 'seller' : 'buyer'
  const statusRaw = str(sp.status)
  const status: BpoStatusFilter = STATUSES.includes(statusRaw as BpoStatusFilter) ? (statusRaw as BpoStatusFilter) : 'all'
  const page = Math.max(1, Number(str(sp.page) ?? '1') || 1)
  const pageSize = 24

  const filters: BpoWorklistFilters = {
    q: str(sp.q) ?? null,
    status,
    posture,
    city: str(sp.city) ?? null,
    page,
    pageSize,
  }

  const result = await listBposForAdmin(filters)
  const openId = str(sp.id)
  const detail = openId ? await getBpoWorklistRowById(openId) : null
  const totalPages = Math.max(1, Math.ceil(result.total / pageSize))

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-foreground">Broker price opinions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Our opinion of value for any home, weighing comps, market conditions, and the property&rsquo;s full listing
          history. Review a draft, finalize it, then send it to the linked contact.
        </p>
      </header>

      <BpoBoard
        filters={filters}
        basePath="/admin/bpo"
        rows={result.rows}
        summary={result.summary}
        cities={result.cities}
        page={result.page}
        totalPages={totalPages}
        detail={detail}
        prepareSendAction={prepareBpoSendPreviewAction}
        sendAction={sendBpoForContactAction}
        sendTestAction={sendBpoTestAction}
        finalizeAction={finalizeBpoAction}
      />
    </div>
  )
}
