// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/prospecting — the ONE prospecting worklist (spec 07) over expired
 * listings + FSBOs. Replaces /admin/expireds, /admin/expired-outreach,
 * /admin/expired-listings[/[key]], /admin/fsbos and the two divergent SMS
 * pipelines. Gated once by `prospecting.view` (superuser + broker) so nothing
 * shown dead-ends (fixes Defect 1).
 */

import { requireAdminPage } from '@/lib/admin/require-admin'
import { listProspects, getProspectDetail } from '@/lib/data'
import type { ProspectKind, ProspectListFilters, ProspectStatusFilter } from '@/lib/data/prospecting/types'
import {
  approveProspectDoc,
  buildProspectDoc,
  prepareProspectSend,
  sendProspectingIntro,
  sendProspectTest,
} from '@/app/actions/prospecting'
import { ProspectingBoard } from '@/components/admin/prospecting/ProspectingBoard.client'

export const dynamic = 'force-dynamic'
// The manual "Build audit" action runs the deterministic CMA builder inline
// (~30–60s); give the segment room so it never times out mid-build (Defect 9).
export const maxDuration = 300

const STATUSES: ProspectStatusFilter[] = ['all', 'sendable', 'needs-audit', 'sent', 'excluded', 'no-phone']

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  const t = s?.trim()
  return t || undefined
}
function numOrNull(v: string | string[] | undefined): number | null {
  const s = str(v)
  if (s == null) return null
  const n = Number(s.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

export default async function ProspectingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage('prospecting.view')
  const sp = await searchParams

  const kind: ProspectKind = str(sp.kind) === 'fsbo' ? 'fsbo' : 'expired'
  const statusRaw = str(sp.status)
  const status: ProspectStatusFilter = STATUSES.includes(statusRaw as ProspectStatusFilter)
    ? (statusRaw as ProspectStatusFilter)
    : 'all'
  const page = Math.max(1, Number(str(sp.page) ?? '1') || 1)
  const pageSize = 24

  const filters: ProspectListFilters = {
    kind,
    q: str(sp.q) ?? null,
    city: str(sp.city) ?? null,
    status,
    minPrice: numOrNull(sp.minPrice),
    maxPrice: numOrNull(sp.maxPrice),
    dateAfter: str(sp.dateAfter) ?? null,
    dateBefore: str(sp.dateBefore) ?? null,
    page,
    pageSize,
  }

  const result = await listProspects(filters)
  const openId = str(sp.id)
  const detail = openId ? await getProspectDetail(kind, openId) : null
  const totalPages = Math.max(1, Math.ceil(result.total / pageSize))

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-foreground">Prospecting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Expired listings and FSBOs. Build the audit, review it, then send one compliant intro. Reply lands in the Inbox.
        </p>
      </header>

      <ProspectingBoard
        kind={kind}
        filters={filters}
        basePath="/admin/prospecting"
        rows={result.rows}
        summary={result.summary}
        cities={result.cities}
        page={result.page}
        totalPages={totalPages}
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
