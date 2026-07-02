// @no-parity — internal admin surface, no public mockup contract
// (gated instead by ci:crm-screen-parity — docs/fub-crm-spec/crm-screens.json "deals-desktop")

/**
 * /admin/crm/deals — the §10 dual-pipeline Deals Kanban
 * (spec: docs/fub-crm-spec/10-deals-pipelines.md).
 *
 * Layout (§2): pipeline sub-bar (tabs + gear + toolbar filters) over a
 * full-width, horizontally-scrolling board of stage columns. Pipeline/status/
 * agent filters + the open deal modal all live in the URL
 * (?pipeline=&status=&agent=&deal=) and switch via client-side navigation —
 * no full page reload (AC-1 #2).
 *
 * Data: DB-backed pipeline config (getDealPipelines — crm_pipelines +
 * crm_deal_stages) + broker-scoped board rows (listDealsBoard — scope enforced
 * at the data layer). Clicking a card mounts the §11 DealDetailModal over the
 * board (getCrmDeal + the same dealInScope guard the mutations use).
 */

import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { dealInScope } from '@/lib/crm/deal-scope'
import { getDealPipelines } from '@/lib/data/crm/getDealPipelines'
import { listDealsBoard, type DealBoardStatusFilter } from '@/lib/data/crm/listDealsBoard'
import { getCrmDeal } from '@/lib/data/crm/getCrmDeal'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { DealsSubBar } from '@/components/admin/crm/deals/DealsSubBar'
import { DealsBoard } from '@/components/admin/crm/deals/DealsBoard'
import { DealDetailModal } from '@/components/admin/crm/deals/DealDetailModal'
import MobileCrmHeader from '@/components/admin/crm/mobile/MobileCrmHeader'
import { CRM_BROKER_DISPLAY } from '@/lib/crm/constants'

/** Broker slug → web headshot (transparent PNG mirror in public/images/brokers). */
const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

export const metadata = { title: 'Deal Tracking | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function CrmDealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  const scoped = scopeBroker(access)
  const isSuperuser = access.role === 'superuser'

  const sp = await searchParams
  const one = (k: string): string | null => {
    const v = sp[k]
    return typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? null) : null
  }

  const statusParam = (one('status') ?? 'current') as DealBoardStatusFilter
  const status: DealBoardStatusFilter = ['current', 'archived', 'all'].includes(statusParam)
    ? statusParam
    : 'current'
  // Agent filter is a superuser affordance (§13) — a restricted broker's set is
  // already scoped at the data layer and cannot widen.
  const agent = isSuperuser ? one('agent') : null

  const [pipelines, deals, crmBrokers] = await Promise.all([
    getDealPipelines(),
    listDealsBoard(scoped, { status, agent }),
    getCrmBrokers(),
  ])

  const brokers = crmBrokers
    .filter((b) => b.crmActive)
    .map((b) => ({ slug: b.slug, name: b.name }))

  // Active pipeline: ?pipeline=<id or name>, defaulting to the first tab.
  const pipeParam = one('pipeline')
  const activePipeline =
    pipelines.find((p) => String(p.id) === pipeParam || p.name === pipeParam) ?? pipelines[0]

  // Board rows for this pipeline only; a pipeline-less deal rides the first tab
  // so nothing is silently dropped (it surfaces in the Unsorted column).
  const activeDeals = deals.filter(
    (d) => (d.pipeline ?? pipelines[0]?.name) === activePipeline?.name,
  )

  // §11 deal detail modal (?deal=) — same scope rule as the mutations.
  const dealParam = one('deal')
  const dealId = dealParam && /^\d+$/.test(dealParam) ? Number(dealParam) : null
  const openDeal = dealId ? await getCrmDeal(dealId) : null
  const openDealVisible =
    openDeal != null &&
    dealInScope(scoped, openDeal.assigned_broker, openDeal.person?.assigned_broker ?? null)

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* ── MOBILE (< md): §23 root-tab navy header — the same language every
             other CRM root wears (People/Activity/Inbox/Calendar). Deals was
             the one root without it (2026-07-02 mobile audit, "one CRM one
             style"). Full-bleed cancels the ConsoleShell main padding. */}
      <div className="-mx-4 -mt-5 mb-3 md:hidden sm:-mx-6 sm:-mt-7">
        <MobileCrmHeader
          brokerName={access.brokerSlug ? CRM_BROKER_DISPLAY[access.brokerSlug as keyof typeof CRM_BROKER_DISPLAY] ?? access.brokerSlug : 'Broker'}
          brokerHeadshot={access.brokerSlug ? BROKER_HEADSHOT[access.brokerSlug] ?? null : null}
          center={<span className="truncate text-lg font-medium text-primary-foreground">Deals</span>}
          searchHref="/admin/crm"
        />
      </div>
      <DealsSubBar
        pipelines={pipelines}
        activePipeline={activePipeline?.name ?? ''}
        status={status}
        agent={agent}
        brokers={brokers}
        isSuperuser={isSuperuser}
        isOwner={isSuperuser}
      />

      <div className="flex-1 bg-muted/30 pt-4">
        {activePipeline ? (
          <DealsBoard
            pipeline={activePipeline}
            deals={activeDeals}
            brokers={brokers}
            isOwner={isSuperuser}
            brokerSlug={access.brokerSlug}
          />
        ) : (
          <p className="px-4 py-8 text-sm text-muted-foreground">No pipelines configured.</p>
        )}
      </div>

      {openDealVisible ? (
        <DealDetailModal
          deal={openDeal}
          pipelines={pipelines}
          brokers={brokers}
          isOwner={isSuperuser}
        />
      ) : null}
    </main>
  )
}
