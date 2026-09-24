// @no-parity — internal admin tool (the file workspace)
//
// A transaction file as a workspace, not a scroll (Matt 2026-09-24: "the ui
// for this system is sooo bad, its just this long scrolling list … refer to
// skyslope for how to manage our transactions and then improve on things where
// they are bad"). He picked the layout: a header with the milestone track, then
// tabs (Overview · Documents · Offers · Email · People · Signing · Money ·
// Activity), and the Documents tab puts the checklist beside the PDF with its
// signature check, where SkySlope opens every preview in a new tab.
//
// Each tab reads only what it shows. One cycle is on screen at a time (the
// cycle switcher in the tab bar picks another), so a relisted or duplicated
// file no longer renders every cycle's documents and checklist twice over.
// The money formatters (exact dollars, date-only slices) are unchanged from
// the page this replaces: a settlement figure never rounds and a closing day
// never shifts through a time zone.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { EntityTitle, Menu, Milestones, StateWord, SubNav, type SubNavItem } from '@/components/admin/v2'
import { getTcDeal } from '@/app/actions/tc'
import { getAnticipatedDocuments } from '@/app/actions/tc-required-docs'
import { getDealContacts } from '@/app/actions/tc-contacts'
import { getCommissionsForCycles } from '@/app/actions/tc-commissions'
import { getEnvelopesForCycle } from '@/app/actions/tc-envelopes'
import { listDealOffers, listEnvelopeTemplates, listFormPackets, getPreferredOrefSaleAgreement } from '@/lib/data'
import { getDealParties } from '@/lib/data/tc/deal-people'
import { listDealMail, listDealConversations } from '@/lib/data/tc/mail-reads'
import { listDealTasks } from '@/lib/data/tc/task-reads'
import { listDealEvents } from '@/lib/data/tc/deal-events'
import { getCycleTerms } from '@/lib/data/tc/deal-terms'
import { hasCapability } from '@/lib/admin/capabilities'
import { getLiveDealCycles } from '@/lib/data/tc/closings'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { executionStateFromClassification } from '@/lib/tc/execution-state'
import { zonedDateKey } from '@/lib/format/date'
import { exactMoney } from '@/lib/tc/dashboard'
import {
  FILE_TABS,
  FILE_TAB_LABEL,
  checklistFilter,
  currentCycle,
  cycleLabel,
  fileAttention,
  fileTab,
  isFinishedFile,
  milestonesFor,
  type FileTab,
} from '@/lib/tc/file-workspace'
import { DealContacts } from './DealContacts'
import { DealEnvelopes } from './DealEnvelopes'
import { DealOffers } from './DealOffers'
import { DealMail } from './DealMail'
import { DealConversations } from './DealConversations'
import { FillOrefPacket } from './FillOrefPacket'
import { DealParties } from './DealParties'
import { DealContingencyDays } from './DealContingencyDays'
import { DealPrices } from './DealPrices'
import { DealStageControls } from './DealStageControls'
import { ListingFileActions } from './ListingFileActions'
import { BuyerAgreementWizard } from './BuyerAgreementWizard'
import { STAGE_LABEL } from './_columns'
import { CommissionSection } from './_parts/CommissionSection'
import { DocumentsTab } from './_parts/DocumentsTab'
import { OverviewTab } from './_parts/OverviewTab'
import { ActivityTab } from './_parts/ActivityTab'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ key: string }>
  searchParams: Promise<{ tab?: string; cycle?: string; doc?: string; filter?: string; archived?: string; page?: string }>
}

const ACTIVITY_PAGE = 50

export default async function TcDealPage({ params, searchParams }: Props) {
  // CAPABILITY GUARD: the list page guards on transactions.view, so the file
  // does too (it shows commissions, splits, settlement figures and every
  // transaction document). Brokers are scoped to their files in getTcDeal.
  const ctx = await requireAdminPage('transactions.view')
  const superuser = ctx.role === 'superuser'

  const { key } = await params
  const sp = await searchParams
  const deal = await getTcDeal(decodeURIComponent(key))
  if (!deal) notFound()

  const tab: FileTab = fileTab(sp.tab)
  const cycle = currentCycle(deal.cycles, deal.stage, sp.cycle ?? null)
  const today = zonedDateKey(new Date())
  const showArchived = sp.archived === '1'
  const base = `/admin/deals/${encodeURIComponent(deal.property_key)}`
  const tabHref = (t: string) => {
    const q = new URLSearchParams()
    if (t !== 'overview') q.set('tab', t)
    if (cycle && sp.cycle) q.set('cycle', cycle.id)
    const s = q.toString()
    return s ? `${base}?${s}` : base
  }

  const checklist = cycle?.checklist ?? []
  const attention = fileAttention({
    propertyKey: deal.property_key,
    stage: deal.stage,
    stageDetail: deal.stage_detail,
    cycle,
    checklist,
    superuser,
    today,
  })
  // A closed or fallen-through file carries no warnings (Matt 2026-09-24).
  const finished = isFinishedFile(deal.stage, cycle)
  const inReview = finished ? 0 : checklist.filter((i) => i.status === 'in_review').length
  const missing = finished ? 0 : checklist.filter((i) => i.status === 'required').length

  // Reads for the header (listing actions need the other live listings).
  const mergeOthers =
    deal.stage === 'active_listing'
      ? (await getLiveDealCycles()).filter(
          (d) =>
            d.propertyKey !== deal.property_key &&
            d.stage === 'active_listing' &&
            dealVisibleToBroker({ role: ctx.role, brokerSlug: ctx.brokerSlug, dealBrokerName: d.brokerName }),
        )
      : []

  // Reads for the tab on screen, and nothing else.
  let body: React.ReactNode = null
  if (tab === 'overview') {
    const [contacts, parties, mail, tasks, terms] = await Promise.all([
      getDealContacts(deal.id),
      getDealParties(deal.id),
      listDealMail(deal.id, 5),
      listDealTasks(deal.id),
      cycle?.kind === 'sale' ? getCycleTerms(cycle.id).catch(() => null) : Promise.resolve(null),
    ])
    body = (
      <OverviewTab
        deal={deal}
        cycle={cycle}
        attention={attention}
        contacts={contacts}
        parties={parties}
        mail={mail}
        tasks={tasks}
        terms={terms}
        canEditTerms={hasCapability(ctx, 'transactions.edit')}
        isPrincipal={superuser}
        tabHref={tabHref}
      />
    )
  } else if (tab === 'documents') {
    body = cycle ? (
      <DocumentsTab
        deal={deal}
        cycle={cycle}
        filter={checklistFilter(sp.filter)}
        selectedDocId={sp.doc ?? null}
        showArchived={showArchived}
        superuser={superuser}
        finished={finished}
        anticipated={await getAnticipatedDocuments(cycle.id)}
      />
    ) : (
      <p className="av2-panel__empty">This file has no cycle yet, so there is no checklist or document to show.</p>
    )
  } else if (tab === 'offers') {
    body = <DealOffers dealId={deal.id} stage={deal.stage} offers={await listDealOffers(deal.id)} />
  } else if (tab === 'email') {
    const [mail, conversations] = await Promise.all([listDealMail(deal.id), listDealConversations(deal.id)])
    body = (
      <div className="av2-stack">
        <DealMail dealId={deal.id} rows={mail} />
        <DealConversations rows={conversations} />
      </div>
    )
  } else if (tab === 'people') {
    const [parties, contacts] = await Promise.all([getDealParties(deal.id), getDealContacts(deal.id)])
    body = (
      <div className="av2-stack">
        <DealParties dealId={deal.id} propertyKey={deal.property_key} parties={parties} />
        <DealContacts dealId={deal.id} contacts={contacts} />
      </div>
    )
  } else if (tab === 'signing') {
    const [envelopeCycles, templates, packets, oref] = await Promise.all([
      Promise.all(
        deal.cycles.map(async (c) => ({
          cycleId: c.id,
          label: c.kind === 'listing' ? 'Listing folder' : `Sale cycle${c.status ? ` · ${c.status}` : ''}`,
          kind: c.kind,
          documents: c.documents
            .filter((doc) => !doc.archived)
            .map((doc) => ({ id: doc.id, name: doc.name, executionState: executionStateFromClassification(doc.classification) })),
          envelopes: await getEnvelopesForCycle(c.id),
        })),
      ),
      listEnvelopeTemplates(),
      listFormPackets(),
      getPreferredOrefSaleAgreement(),
    ])
    const buyerSide = !!cycle && (cycle.kind === 'sale' && cycle.checklist.some((it) => /buyer representation|buyer.?s? rep/i.test(it.name)))
    body = (
      <div className="av2-stack">
        <DealEnvelopes cycles={envelopeCycles} templates={templates} packets={packets} />
        {cycle ? <FillOrefPacket cycleId={cycle.id} form={oref.data} /> : null}
        {cycle && buyerSide ? (
          <BuyerAgreementWizard cycleId={cycle.id} propertyKey={deal.property_key} brokerName={cycle.broker_name ?? deal.broker_name} />
        ) : null}
      </div>
    )
  } else if (tab === 'money') {
    const commissions = cycle ? await getCommissionsForCycles([cycle.id]) : []
    body = cycle ? (
      <div className="av2-stack">
        <DealPrices cycleId={cycle.id} propertyKey={deal.property_key} listingPrice={cycle.listing_price} salePrice={cycle.sale_price} />
        <DealContingencyDays
          cycleId={cycle.id}
          dealId={deal.id}
          propertyKey={deal.property_key}
          inspectionDays={cycle.inspection_days}
          financingDays={cycle.financing_days}
        />
        <CommissionSection rows={commissions} cycleId={cycle.id} propertyKey={deal.property_key} />
      </div>
    ) : (
      <p className="av2-panel__empty">This file has no cycle yet, so there are no prices or commissions to show.</p>
    )
  } else if (tab === 'activity') {
    const page = Math.max(1, Number(sp.page) || 1)
    const { rows, total } = await listDealEvents(deal.id, { limit: ACTIVITY_PAGE, offset: (page - 1) * ACTIVITY_PAGE })
    body = (
      <ActivityTab
        rows={rows}
        total={total}
        page={page}
        pageSize={ACTIVITY_PAGE}
        pageHref={(p) => `${tabHref('activity')}${tabHref('activity').includes('?') ? '&' : '?'}page=${p}`}
      />
    )
  }

  const tabs: SubNavItem[] = FILE_TABS.map((t) => ({
    key: t,
    label: FILE_TAB_LABEL[t],
    href: tabHref(t),
    current: t === tab,
    badge: t === 'documents' ? (superuser ? inReview || missing : missing) : undefined,
    hot: t === 'documents' && superuser && inReview > 0,
  }))

  const price = cycle ? (cycle.kind === 'listing' ? cycle.listing_price : cycle.sale_price ?? cycle.listing_price) : null
  const primary =
    superuser && inReview
      ? { label: `Review ${inReview}`, href: `${base}?tab=documents${cycle ? `&cycle=${cycle.id}` : ''}&filter=review` }
      : missing
        ? { label: `${missing} missing`, href: `${base}?tab=documents${cycle ? `&cycle=${cycle.id}` : ''}&filter=missing` }
        : { label: 'Documents', href: `${base}?tab=documents${cycle ? `&cycle=${cycle.id}` : ''}` }

  const cycleSwitch =
    deal.cycles.length > 1 && cycle ? (
      <Menu
        label="Switch cycle"
        align="end"
        triggerClassName="av2-btn av2-btn--quiet"
        trigger={<span style={{ fontSize: 'var(--a-text-sm)', whiteSpace: 'nowrap' }}>{cycleLabel(cycle).split(' · ').slice(0, 2).join(' · ')} ▾</span>}
        items={deal.cycles.map((c) => {
          const q = new URLSearchParams()
          if (tab !== 'overview') q.set('tab', tab)
          q.set('cycle', c.id)
          return { label: `${c.id === cycle.id ? '✓ ' : ''}${cycleLabel(c)}`, href: `${base}?${q.toString()}` }
        })}
      />
    ) : cycle ? (
      <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', whiteSpace: 'nowrap' }}>{cycleLabel(cycle).split(' · ').slice(0, 2).join(' · ')}</span>
    ) : null

  return (
    <div className="av2-scope av2-wide">
      <header className="av2-filehead">
        <Link href="/admin/closings" className="av2-filehead__crumb">
          Transactions
        </Link>
        <div className="av2-filehead__row">
          <div className="av2-filehead__id">
            <EntityTitle>{deal.address}</EntityTitle>
            <div className="av2-filehead__facts">
              <StateWord state={deal.stage === 'dead' ? 'down' : deal.stage === 'closed' ? 'ok' : 'accent'}>
                {STAGE_LABEL[deal.stage] ?? deal.stage}
              </StateWord>
              {cycle ? <span>{cycle.kind === 'listing' ? 'Listing' : 'Sale'}</span> : null}
              <span>{deal.broker_name ?? 'No broker'}</span>
              {price != null ? <span className="av2-filehead__price">{exactMoney(price)}</span> : null}
              {cycle?.mls_number ? <span>MLS {cycle.mls_number}</span> : null}
              {deal.stage_detail && deal.stage_detail !== STAGE_LABEL[deal.stage] ? <span>{deal.stage_detail}</span> : null}
            </div>
          </div>
          <div className="av2-filehead__actions">
            <Link href={primary.href} className="av2-btn" style={{ textDecoration: 'none' }} scroll={false}>
              {primary.label}
            </Link>
            <DealStageControls propertyKey={deal.property_key} stage={deal.stage} brokerName={deal.broker_name} canAssign={superuser} />
            <ListingFileActions propertyKey={deal.property_key} stage={deal.stage} others={mergeOthers} />
          </div>
        </div>
        <Milestones steps={milestonesFor(cycle, today)} label="Where this file stands" />
      </header>

      <SubNav items={tabs} sticky aside={cycleSwitch} label="File sections" />

      {deal.cycles.length === 0 && tab !== 'overview' && tab !== 'people' && tab !== 'email' && tab !== 'offers' && tab !== 'activity' ? (
        <p className="av2-panel__empty">
          This file has no cycle yet. Documents, the checklist and commission hang off a cycle, so there is nothing to show until one exists.
        </p>
      ) : null}
      {body}
    </div>
  )
}
