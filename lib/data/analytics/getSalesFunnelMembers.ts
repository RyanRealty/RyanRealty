/**
 * People / identified-session drill-down for a sales-funnel stage or door.
 */
import 'server-only'
import { unstable_cache } from 'next/cache'
import { isAttributableLead } from '@/lib/data/crm/leadSourceTaxonomy'
import {
  captureDoorById,
  doorForPerson,
  doorIsImmediateWorking,
  personAppearsInAudience,
  sessionAppearsInAudience,
  type CaptureDoorId,
  type FunnelAudience,
} from './captureDoors'
import { ENGAGED_SCORE_MIN, FUNNEL_MEMBER_CAP, type CountKind, type FunnelStageId } from './salesFunnelMath'
import {
  namesForIds,
  personHref,
  personName,
  rangeToIso,
  readDeals,
  readPeople,
  readSessions,
  readWorkingPersonIds,
  sellerClientPersonIds,
  type DealRow,
  type PersonRow,
  type SessionRow,
} from './salesFunnelRead'
import type { SalesFunnelInput } from './getSalesFunnel'

export type SalesFunnelMembersInput = SalesFunnelInput & {
  stage?: FunnelStageId | null
  door?: CaptureDoorId | null
}

export type FunnelMember = {
  personId: number | null
  name: string
  source: string | null
  doorLabel: string
  createdAt: string
  href: string | null
}

export type SalesFunnelMembers = {
  title: string
  countKind: CountKind
  total: number
  shown: number
  members: FunnelMember[]
  note: string | null
  unmeasuredReason: string | null
}

function sliceMembers(rows: FunnelMember[]): { members: FunnelMember[]; shown: number; total: number } {
  const total = rows.length
  const members = rows.slice(0, FUNNEL_MEMBER_CAP)
  return { members, shown: members.length, total }
}

function filterCohort(people: PersonRow[], audience: FunnelAudience): PersonRow[] {
  return people.filter((p) => {
    if (!personAppearsInAudience(p.tags, p.source, audience)) return false
    if (audience === 'recruit') return true
    return isAttributableLead(p.source)
  })
}

async function readSalesFunnelMembers(input: SalesFunnelMembersInput): Promise<SalesFunnelMembers> {
  const { startIso, endIso } = rangeToIso(input.startDate, input.endDate)
  const door = input.door ?? null
  const stage = input.stage ?? (door ? 'lead' : null)

  if (!stage && !door) {
    return {
      title: 'Select a stage or a door',
      countKind: 'people',
      total: 0,
      shown: 0,
      members: [],
      note: 'Click a spine stage or a capture door to see the people in this cohort.',
      unmeasuredReason: null,
    }
  }

  if (stage === 'client' && input.audience !== 'seller') {
    return {
      title: 'Client',
      countKind: 'people',
      total: 0,
      shown: 0,
      members: [],
      note: null,
      unmeasuredReason:
        input.audience === 'buyer'
          ? 'A buyer is a client when a buyer-rep agreement is signed. That signature is not stored, so there is no people list to open.'
          : 'No signed-agreement writer for this audience.',
    }
  }

  const needSessions = stage === 'visited' || stage === 'engaged' || stage === 'identified'
  const needDeals = input.audience === 'seller' && stage === 'client'
  const [peopleRes, sessionsRes, dealsRes] = await Promise.all([
    readPeople(startIso, endIso),
    needSessions
      ? readSessions(startIso, endIso)
      : Promise.resolve({ rows: [] as SessionRow[], error: null as string | null }),
    needDeals ? readDeals() : Promise.resolve({ rows: [] as DealRow[], error: null as string | null }),
  ])

  const dealRows = dealsRes.rows

  if (peopleRes.error) {
    return {
      title: 'People',
      countKind: 'people',
      total: 0,
      shown: 0,
      members: [],
      note: null,
      unmeasuredReason: `Could not read crm_people: ${peopleRes.error}`,
    }
  }

  let cohort = filterCohort(peopleRes.rows, input.audience)
  if (door) cohort = cohort.filter((p) => doorForPerson(p.source, p.tags).id === door)

  if (stage === 'visited' || stage === 'engaged' || stage === 'identified') {
    const sessions = (sessionsRes.rows ?? []).filter((s) =>
      sessionAppearsInAudience(s.intent_tags, input.audience, s.landing_page),
    )
    const filtered =
      stage === 'engaged'
        ? sessions.filter((s) => Number(s.engagement_score ?? 0) >= ENGAGED_SCORE_MIN)
        : stage === 'identified'
          ? sessions.filter((s) => s.crm_person_id != null || s.identified_at != null)
          : sessions
    const identifiedOnly = filtered.filter((s) => s.crm_person_id != null)
    const ids = [...new Set(identifiedOnly.map((s) => Number(s.crm_person_id)))]
    const names = await namesForIds(ids)
    const members: FunnelMember[] = identifiedOnly.map((s) => {
      const pid = Number(s.crm_person_id)
      return {
        personId: pid,
        name: names.get(pid) ?? `Visitor ${s.session_id.slice(0, 8)}`,
        source: null,
        doorLabel: 'On-site session',
        createdAt: s.first_seen_at,
        href: personHref(pid),
      }
    })
    const sliced = sliceMembers(members)
    const anon = filtered.length - identifiedOnly.length
    return {
      title:
        stage === 'visited'
          ? 'Visited (identified sessions)'
          : stage === 'engaged'
            ? 'Engaged (identified sessions)'
            : 'Identified on-site',
      countKind: 'sessions',
      ...sliced,
      total: filtered.length,
      note:
        anon > 0
          ? `${anon} sessions in this stage have no CRM person, so they have no people page. Showing identified sessions only, cap ${FUNNEL_MEMBER_CAP}.`
          : `Showing ${sliced.shown} of ${filtered.length}.`,
      unmeasuredReason: null,
    }
  }

  const leadIds = cohort.map((p) => p.id)
  const wr = await readWorkingPersonIds(leadIds, startIso)
  const workingIds = new Set(wr.ids)
  for (const p of cohort) {
    if (doorIsImmediateWorking(doorForPerson(p.source, p.tags))) workingIds.add(p.id)
  }

  let rows = cohort
  if (stage === 'working') rows = cohort.filter((p) => workingIds.has(p.id))
  if (stage === 'client') {
    const clientDealIds = sellerClientPersonIds(dealRows)
    rows = cohort.filter((p) => clientDealIds.has(p.id))
  }

  const members: FunnelMember[] = rows.map((p) => {
    const d = doorForPerson(p.source, p.tags)
    return {
      personId: p.id,
      name: personName(p),
      source: p.source,
      doorLabel: d.label,
      createdAt: p.created_at,
      href: personHref(p.id),
    }
  })
  const sliced = sliceMembers(members)
  const title = door
    ? captureDoorById(door).label
    : stage === 'working'
      ? 'Broker touched them'
      : stage === 'client'
        ? 'Client (Listed or later)'
        : 'Inbound leads'
  return {
    title,
    countKind: 'people',
    ...sliced,
    note: sliced.total > sliced.shown ? `Showing ${sliced.shown} of ${sliced.total}.` : null,
    unmeasuredReason: null,
  }
}

export async function getSalesFunnelMembers(input: SalesFunnelMembersInput): Promise<SalesFunnelMembers> {
  const cached = unstable_cache(
    () => readSalesFunnelMembers(input),
    [
      'sales-funnel-members-v1',
      input.startDate,
      input.endDate,
      input.audience,
      input.stage ?? '',
      input.door ?? '',
    ],
    { tags: ['crm-lead-intake', 'crm-reporting', 'sales-funnel'], revalidate: 600 },
  )
  return cached()
}
