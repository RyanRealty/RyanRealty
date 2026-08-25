/**
 * getSalesFunnel — cohort sales-funnel for /admin/analytics?tab=funnel.
 *
 * Definitions (locked with Matt 2026-08-22):
 *   Spine counts unique people (sessions before a person exists).
 *   Doors count first-recorded source events.
 *   TAM is not a stage.
 *   Discovery channels are never summed.
 *   LLM citations are UNMEASURED.
 *   Lead = attributable inbound crm_people in the window (same as getLeadIntake).
 *   Working = a broker touch after capture, or a phone/text door which is the touch.
 *   Seller client = Sellers pipeline Listed / Offer / Pending / Closed.
 *   Buyer client = signed buyer-rep. No writer. UNMEASURED.
 *   Referral signed = no signed-date column. UNMEASURED.
 *   Farm / Import / Sphere are not leads.
 *
 * Adjacent stages that do not share identity are not given a conversion rate.
 */

import 'server-only'
import { unstable_cache } from 'next/cache'
import { isAttributableLead } from '@/lib/data/crm/leadSourceTaxonomy'
import { listReferralReceivables } from '@/lib/data/crm/referralReceivables'
import {
  doorForPerson,
  doorIsImmediateWorking,
  isDoorOnFunnelBoard,
  isManualDoorSource,
  personAppearsInAudience,
  type CaptureDoor,
  type CaptureDoorId,
  type FunnelAudience,
} from './captureDoors'
import { ENGAGED_SCORE_MIN, nestedRate, type CountKind, type FunnelStageId } from './salesFunnelMath'
import { ga4SessionSum, rollDiscovery, type DiscoveryChannel } from './discoveryPlatforms'
import {
  countAudienceSessions,
  readAccountSnapshots,
  readActiveBrokers,
  readDeals,
  readJoinConverts,
  readPeople,
  readWorkingPersonIds,
  sellerClientPersonIds,
  rangeToIso,
  type ActiveBrokerRow,
  type PersonRow,
} from './salesFunnelRead'

export type { CaptureDoorId, FunnelAudience, FunnelStageId, CountKind, DiscoveryChannel }

export type SalesFunnelInput = {
  startDate: string
  endDate: string
  audience: FunnelAudience
}

export type SpineStage = {
  id: FunnelStageId
  label: string
  count: number | null
  countKind: CountKind
  unmeasuredReason: string | null
  nestedOf: FunnelStageId | null
  conversionFromPrev: number | null
}

export type CaptureDoorStat = {
  id: CaptureDoorId
  label: string
  audience: CaptureDoor['audience']
  events: number
  uniquePeople: number
  working: number
  clients: number
  manual: boolean
}

export type BrokerBook = {
  slug: string
  name: string
  inboundLeads: number
  working: number
  listedPlus: number
}

export type SalesFunnel = {
  audience: FunnelAudience
  startDate: string
  endDate: string
  discovery: DiscoveryChannel[]
  unclassifiedVisits: number
  stages: SpineStage[]
  doors: CaptureDoorStat[]
  stock: {
    sellerListedPlusNow: number
    buyerRepUnmeasured: true
    referralSignedUnmeasured: true
    referralHandoffs: number | null
    activeBrokersNow: number
  }
  joinConverts: number
  brokerBooks: BrokerBook[]
  holes: { id: string; label: string; reason: string }[]
  unreadable: boolean
  leadCohortSize: number
  workingCohortSize: number
  clientCohortSize: number | null
  clientUnmeasured: boolean
  /** GA4 sessions in the window. Consent-gated. Not the first-party visit spine. */
  ga4Sessions: number | null
  ga4SessionsCaveat: string | null
}

function emptyFunnel(input: SalesFunnelInput, unreadable: boolean): SalesFunnel {
  return {
    audience: input.audience,
    startDate: input.startDate,
    endDate: input.endDate,
    discovery: rollDiscovery([]).map((c) =>
      unreadable
        ? {
            ...c,
            count: null,
            secondary: c.secondary.map((s) => ({ ...s, count: null })),
            unmeasuredReason: c.unmeasuredReason ?? 'Could not read marketing_channel_daily.',
            caveat: null,
          }
        : c,
    ),
    unclassifiedVisits: 0,
    stages: [],
    doors: [],
    stock: {
      sellerListedPlusNow: 0,
      buyerRepUnmeasured: true,
      referralSignedUnmeasured: true,
      referralHandoffs: null,
      activeBrokersNow: 0,
    },
    joinConverts: 0,
    brokerBooks: [],
    holes: [],
    unreadable,
    leadCohortSize: 0,
    workingCohortSize: 0,
    clientCohortSize: input.audience === 'seller' ? 0 : null,
    clientUnmeasured: input.audience !== 'seller',
    ga4Sessions: null,
    ga4SessionsCaveat: unreadable ? 'Could not read marketing_channel_daily.' : null,
  }
}

function buildHoles(input: SalesFunnelInput): SalesFunnel['holes'] {
  const holes: SalesFunnel['holes'] = [
    {
      id: 'tam',
      label: 'Everyone / addressable market',
      reason: 'Not a funnel stage. No unique-people count is shown for TAM.',
    },
    {
      id: 'identity-join',
      label: 'Saw us → visited',
      reason: 'Platform impressions and site sessions do not share a person id. That conversion is UNMEASURED. Platform counts are never added together.',
    },
    {
      id: 'llm',
      label: 'LLM / AI answers',
      reason: 'No citation writer. ChatGPT and similar mentions are UNMEASURED.',
    },
    {
      id: 'tiktok-period',
      label: 'TikTok period reach',
      reason: 'TikTok writes cumulative video views, not daily impressions. Period reach is UNMEASURED.',
    },
    {
      id: 'referral-signed',
      label: 'Referral agreement signed',
      reason: 'referral_receivables has no signed-date column. Handoffs are recorded. Signatures are UNMEASURED.',
    },
  ]
  if (input.audience !== 'seller') {
    holes.unshift({
      id: 'buyer-rep',
      label: 'Buyer-rep agreement signed',
      reason:
        'A buyer is a client the moment a buyer representation agreement is signed. That signature is not stored on the CRM deal board, so CLIENT is UNMEASURED for buyers.',
    })
  }
  if (input.audience === 'recruit') {
    holes.unshift({
      id: 'recruit-ica',
      label: 'Recruit signed',
      reason: 'No independent-contractor agreement writer. A recruit is on the team when they are an active broker. Signed ICA date is UNMEASURED.',
    })
  }
  return holes
}

// Generic so the caller's row type survives the filter. Typing the parameter as a
// bare 3-field shape widened `cohort` to that shape, which then would not satisfy
// PersonRow where the cohort feeds bumpDoor and buildBrokerBooks (those need name,
// created_at and assigned_broker). Constrain, do not narrow.
function filterCohort<T extends { id: number; source: string | null; tags: string[] | null }>(
  people: T[],
  audience: FunnelAudience,
): T[] {
  return people.filter((p) => {
    if (!personAppearsInAudience(p.tags, p.source, audience)) return false
    if (audience === 'recruit') return true
    return isAttributableLead(p.source)
  })
}

async function readSalesFunnel(input: SalesFunnelInput): Promise<SalesFunnel> {
  const { startIso, endIso } = rangeToIso(input.startDate, input.endDate)
  const [peopleRes, sessionCounts, snapRes, dealsRes, referralRes, brokersRes, joinRes] = await Promise.all([
    readPeople(startIso, endIso),
    countAudienceSessions(startIso, endIso, input.audience, ENGAGED_SCORE_MIN),
    readAccountSnapshots(input.startDate, input.endDate),
    readDeals(),
    listReferralReceivables(500),
    readActiveBrokers(),
    readJoinConverts(startIso, endIso),
  ])

  if (peopleRes.error || sessionCounts.error || dealsRes.error || snapRes.error) {
    const empty = emptyFunnel(input, true)
    empty.holes = buildHoles(input)
    return empty
  }

  const clientDealIds = sellerClientPersonIds(dealsRes.rows)
  const cohort = filterCohort(peopleRes.rows, input.audience)
  const manualRows = peopleRes.rows.filter(
    (p) => isManualDoorSource(p.source) && personAppearsInAudience(p.tags, p.source, input.audience),
  )
  const bookPeople: PersonRow[] =
    input.audience === 'recruit'
      ? peopleRes.rows.filter(
          (p) => isAttributableLead(p.source) && !personAppearsInAudience(p.tags, p.source, 'recruit'),
        )
      : cohort

  const unclassifiedVisits = Math.max(0, sessionCounts.total - sessionCounts.visited)

  const leadIds = cohort.map((p) => p.id)
  const bookIds = bookPeople.map((p) => p.id)
  const workingRes = await readWorkingPersonIds([...new Set([...leadIds, ...bookIds])], startIso)
  const workingIds = new Set(workingRes.ids)
  for (const p of [...cohort, ...bookPeople]) {
    if (doorIsImmediateWorking(doorForPerson(p.source, p.tags))) workingIds.add(p.id)
  }
  for (const id of joinRes.personIds) {
    if (leadIds.includes(id)) workingIds.add(id)
  }

  const clientUnmeasured = input.audience !== 'seller'
  const clientIds = new Set<number>()
  if (!clientUnmeasured) {
    for (const id of leadIds) {
      if (clientDealIds.has(id)) clientIds.add(id)
    }
  }

  const doorMap = new Map<CaptureDoorId, CaptureDoorStat>()
  const bumpDoor = (p: PersonRow, manual: boolean) => {
    const door = doorForPerson(p.source, p.tags)
    if (!isDoorOnFunnelBoard(door)) return
    const row =
      doorMap.get(door.id) ??
      ({
        id: door.id,
        label: door.label,
        audience: door.audience,
        events: 0,
        uniquePeople: 0,
        working: 0,
        clients: 0,
        manual,
      } satisfies CaptureDoorStat)
    row.events += 1
    row.uniquePeople += 1
    if (workingIds.has(p.id)) row.working += 1
    if (clientIds.has(p.id)) row.clients += 1
    doorMap.set(door.id, row)
  }
  for (const p of cohort) bumpDoor(p, false)
  for (const p of manualRows) bumpDoor(p, true)

  const visited = sessionCounts.visited
  const engagedN = sessionCounts.engaged
  const identifiedN = sessionCounts.identified
  const ga4 = ga4SessionSum(snapRes.rows)
  const leads = cohort.length
  const workingN = leadIds.filter((id) => workingIds.has(id)).length
  const clientsN = clientUnmeasured ? null : clientIds.size
  const recruit = input.audience === 'recruit'

  const stages: SpineStage[] = [
    {
      id: 'visited',
      label: recruit ? 'Visited /join' : 'Visited the site',
      count: visited,
      countKind: 'sessions',
      unmeasuredReason: null,
      nestedOf: null,
      conversionFromPrev: null,
    },
    {
      id: 'engaged',
      label: recruit ? 'Engaged on /join' : 'Engaged visit',
      count: engagedN,
      countKind: 'sessions',
      unmeasuredReason: null,
      nestedOf: 'visited',
      conversionFromPrev: nestedRate(engagedN, visited),
    },
    {
      id: 'identified',
      label: 'Identified on-site',
      count: identifiedN,
      countKind: 'sessions',
      unmeasuredReason: null,
      nestedOf: 'visited',
      conversionFromPrev: nestedRate(identifiedN, visited),
    },
    {
      id: 'lead',
      label: recruit ? 'Recruit inquiry' : 'Inbound lead',
      count: leads,
      countKind: 'people',
      unmeasuredReason: null,
      nestedOf: null,
      conversionFromPrev: null,
    },
    {
      id: 'working',
      label: recruit ? 'Conversation started' : 'Broker touched them',
      count: workingN,
      countKind: 'people',
      unmeasuredReason: null,
      nestedOf: 'lead',
      conversionFromPrev: nestedRate(workingN, leads),
    },
    {
      id: 'client',
      label: recruit
        ? 'On the team (ICA signed)'
        : input.audience === 'seller'
          ? 'Client (Listed or later)'
          : 'Client (buyer-rep signed)',
      count: clientsN,
      countKind: 'people',
      unmeasuredReason: clientUnmeasured
        ? input.audience === 'buyer'
          ? 'A buyer is a client when a buyer-rep agreement is signed. That signature is not stored, so this stage is UNMEASURED.'
          : 'A recruit is on the team when they sign an independent contractor agreement. That signature is not stored, so this stage is UNMEASURED. Active brokers are on the stock strip.'
        : null,
      nestedOf: clientUnmeasured ? null : 'lead',
      conversionFromPrev: clientUnmeasured ? null : nestedRate(clientsN ?? 0, leads),
    },
  ]

  return {
    audience: input.audience,
    startDate: input.startDate,
    endDate: input.endDate,
    discovery: rollDiscovery(snapRes.rows),
    unclassifiedVisits,
    stages,
    doors: Array.from(doorMap.values()).sort((a, b) => b.events - a.events),
    stock: {
      sellerListedPlusNow: clientDealIds.size,
      buyerRepUnmeasured: true,
      referralSignedUnmeasured: true,
      referralHandoffs: referralRes.available ? referralRes.rows.length : null,
      activeBrokersNow: brokersRes.rows.length,
    },
    joinConverts: joinRes.error ? 0 : joinRes.sessions,
    brokerBooks: buildBrokerBooks(brokersRes.rows, bookPeople, workingIds, clientDealIds),
    holes: buildHoles(input),
    unreadable: false,
    leadCohortSize: leads,
    workingCohortSize: workingN,
    clientCohortSize: clientsN,
    clientUnmeasured,
    ga4Sessions: ga4.rows === 0 ? null : ga4.value,
    ga4SessionsCaveat:
      ga4.rows === 0
        ? 'No GA4 session snapshot rows in this window. Consent-gated. First-party visits are the spine.'
        : 'GA4 is consent-gated. First-party visits on the spine below are the site count.',
  }
}

function buildBrokerBooks(
  brokers: ActiveBrokerRow[],
  people: PersonRow[],
  workingIds: Set<number>,
  listedIds: Set<number>,
): BrokerBook[] {
  const bySlug = new Map<string, BrokerBook>()
  for (const b of brokers) {
    bySlug.set(b.crmSlug, {
      slug: b.crmSlug,
      name: b.name,
      inboundLeads: 0,
      working: 0,
      listedPlus: 0,
    })
  }
  const unassigned: BrokerBook = {
    slug: 'unassigned',
    name: 'Unassigned',
    inboundLeads: 0,
    working: 0,
    listedPlus: 0,
  }
  for (const p of people) {
    const key = (p.assigned_broker ?? '').trim().toLowerCase()
    const row = (key && bySlug.get(key)) || unassigned
    row.inboundLeads += 1
    if (workingIds.has(p.id)) row.working += 1
    if (listedIds.has(p.id)) row.listedPlus += 1
  }
  const out = [...bySlug.values()].sort((a, b) => b.inboundLeads - a.inboundLeads)
  if (unassigned.inboundLeads > 0) out.push(unassigned)
  return out
}

export async function getSalesFunnel(input: SalesFunnelInput): Promise<SalesFunnel> {
  const cached = unstable_cache(
    () => readSalesFunnel(input),
    ['sales-funnel-v4', input.startDate, input.endDate, input.audience],
    { tags: ['crm-lead-intake', 'crm-reporting', 'sales-funnel'], revalidate: 600 },
  )
  return cached()
}
