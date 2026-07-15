'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { getGcalEvents, type GcalEvent } from '@/lib/google-calendar'
import { getAppointments } from '@/lib/data/crm/getAppointments'

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

export type CommandDeal = {
  id: string
  propertyKey: string
  address: string
  city: string | null
  stage: string
  stageDetail: string | null
  closingDate: string | null
  contractDate: string | null
  listingPrice: number | null
  salePrice: number | null
  brokerName: string | null
  parties: string[]
  checklistTotal: number
  checklistComplete: number
}

export type CommandTask = {
  id: number
  name: string
  dueAt: string | null
  type: string | null
  personName: string | null
  personId: number | null
  isOverdue: boolean
}

export type CommandClient = {
  id: number
  name: string | null
  stage: string
  lastActivityAt: string | null
  assignedBroker: string | null
  source: string | null
  pictureUrl: string | null
  tags: string[]
}

export type CalendarItem = {
  date: string
  label: string
  sublabel: string
  type: 'closing' | 'contract' | 'expiration' | 'task' | 'gcal'
  href: string | null
  gcalLink: string | null
}

export type MarketingListing = {
  listingKey: string
  address: string
  listPrice: number | null
  photoUrl: string | null
  status: string
}

export type BrokerCommandCenterData = {
  broker: {
    id: string
    slug: string
    displayName: string
    photoUrl: string | null
    email: string | null
  }
  activeDeals: CommandDeal[]
  tasksDue: CommandTask[]
  /** Exact count of open tasks due later today — the limit-capped tasksDue
   *  list undercounts once overdue + today exceed the fetch limit. */
  tasksTodayCount: number
  activeClients: CommandClient[]
  calendar: CalendarItem[]
  gcalConnected: boolean
  myListings: MarketingListing[]
  isSuperuser: boolean
}

export async function getBrokerCommandCenterData(
  /** Superuser scope toggle: 'everyone' (default) sees all brokers' books;
   *  'me' narrows every section to the superuser's own book. Non-superusers
   *  are always scoped to themselves regardless of this value. */
  scope: 'everyone' | 'me' = 'everyone',
): Promise<BrokerCommandCenterData | null> {
  const session = await getSession()
  const email = session?.user?.email?.trim()
  if (!email) return null

  const role = await getAdminRoleForEmail(email)
  if (!role) return null

  const isSuperuser = role.role === 'superuser'
  const brokerId = role.brokerId

  // Fetch broker record
  const { data: brokerRow } = await sb()
    .from('brokers')
    .select('id,slug,display_name,photo_url,email')
    .eq('id', brokerId ?? '00000000-0000-0000-0000-000000000000')
    .maybeSingle()

  // For superuser without a broker record, return a shell
  if (!brokerRow && !isSuperuser) return null
  const broker = brokerRow
    ? { id: brokerRow.id, slug: brokerRow.slug, displayName: brokerRow.display_name, photoUrl: brokerRow.photo_url, email: brokerRow.email }
    : { id: '', slug: 'matt', displayName: 'Matt', photoUrl: null, email }

  // crm_tasks + crm_people store the SHORT CRM slug (matt/rebecca/paul); the
  // brokers table uses long slugs (matthew-ryan/...). Scope by the short slug
  // resolved from email (same source as getCrmAccess) — using brokerRow.slug
  // matched zero rows, so Paul/Rebecca saw empty Tasks + Active clients.
  const crmSlug = email ? (CRM_BROKER_BY_EMAIL[email.toLowerCase()] ?? null) : null

  // Effective scoping: non-superusers always see only their own book; a
  // superuser sees everything unless they picked 'Just me' on the dashboard.
  const scopeToSelf = !isSuperuser || scope === 'me'
  const brokerDisplayName = brokerRow?.display_name

  // Time anchors, hoisted above the concurrent kickoff (tasks query + the
  // tasksDue mapping + appointments window all read them).
  // Stale floor: a task more than a month past due is almost never real — it is
  // FUB import cruft (e.g. "add automation tag", due months ago). Hide it from
  // the action pile so the dashboard surfaces only tasks a broker would
  // actually act on today. Matt directive 2026-06-15.
  const now = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
  const STALE_TASK_DAYS = 31
  const staleFloor = new Date(now.getTime() - STALE_TASK_DAYS * 86_400_000).toISOString()
  const apptFrom = now.toISOString().slice(0, 10)
  const apptTo   = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // 1. Active TC deals (stage != closed) — the only chain with a true data
  // dependency (deals → cycles + checklist), so it runs as one async unit
  // inside the concurrent batch below.
  const loadDeals = async (): Promise<CommandDeal[]> => {
    const dealsQuery = sb()
      .from('tc_deals')
      .select('id,property_key,address,city,stage,stage_detail,broker_name,fub_person_ids,created_at,updated_at')
      .neq('stage', 'closed')
      .order('updated_at', { ascending: false })
      .limit(20)

    if (scopeToSelf && brokerDisplayName) {
      dealsQuery.eq('broker_name', brokerDisplayName)
    }

    const { data: dealsRaw } = await dealsQuery
    const activeDeals: CommandDeal[] = []
    if (!dealsRaw || dealsRaw.length === 0) return activeDeals

    const dealIds = dealsRaw.map((d: Record<string, unknown>) => d.id as string)

    const [cyclesRes, checklistRes] = await Promise.all([
      sb()
        .from('tc_cycles')
        .select('deal_id,kind,buyers,sellers,listing_price,sale_price,contract_acceptance_date,escrow_closing_date,expiration_date,status')
        .in('deal_id', dealIds),
      sb()
        .from('tc_checklist_items')
        .select('deal_id:tc_cycles!inner(deal_id),status')
        .in('tc_cycles.deal_id', dealIds),
    ])

    // Map cycles by deal_id
    const cyclesByDeal: Record<string, Record<string, unknown>[]> = {}
    for (const c of cyclesRes.data ?? []) {
      const row = c as Record<string, unknown>
      const did = row.deal_id as string
      if (!cyclesByDeal[did]) cyclesByDeal[did] = []
      cyclesByDeal[did].push(row)
    }

    // Checklist stats by deal_id (via join)
    const checklistStats: Record<string, { total: number; complete: number }> = {}
    for (const item of checklistRes.data ?? []) {
      const row = item as unknown as { deal_id?: string; status?: string; tc_cycles?: { deal_id: string } }
      const did = row.tc_cycles?.deal_id ?? row.deal_id
      if (!did) continue
      if (!checklistStats[did]) checklistStats[did] = { total: 0, complete: 0 }
      checklistStats[did].total++
      if (row.status === 'completed') checklistStats[did].complete++
    }

    for (const deal of dealsRaw as Record<string, unknown>[]) {
      const did = deal.id as string
      const cycles = cyclesByDeal[did] ?? []
      // Prefer sale cycle, fall back to listing
      const cycle = cycles.find((c) => c.kind === 'sale') ?? cycles[0] ?? null
      const buyers = Array.isArray(cycle?.buyers) ? (cycle.buyers as string[]) : []
      const sellers = Array.isArray(cycle?.sellers) ? (cycle.sellers as string[]) : []
      const stats = checklistStats[did] ?? { total: 0, complete: 0 }

      activeDeals.push({
        id: did,
        propertyKey: deal.property_key as string,
        address: deal.address as string,
        city: deal.city as string | null,
        stage: deal.stage as string,
        stageDetail: deal.stage_detail as string | null,
        closingDate: cycle?.escrow_closing_date as string | null ?? null,
        contractDate: cycle?.contract_acceptance_date as string | null ?? null,
        listingPrice: cycle?.listing_price as number | null ?? null,
        salePrice: cycle?.sale_price as number | null ?? null,
        brokerName: deal.broker_name as string | null,
        parties: [...buyers, ...sellers].filter(Boolean).slice(0, 4),
        checklistTotal: stats.total,
        checklistComplete: stats.complete,
      })
    }

    // Sort: soonest closing first, then by address
    activeDeals.sort((a, b) => {
      if (a.closingDate && b.closingDate) return a.closingDate.localeCompare(b.closingDate)
      if (a.closingDate) return -1
      if (b.closingDate) return 1
      return a.address.localeCompare(b.address)
    })
    return activeDeals
  }

  // 2. Tasks due (overdue + today) — capped list for the action pile.
  const tasksQuery = sb()
    .from('crm_tasks')
    .select('id,name,type,due_at,assigned_broker,person_id,crm_people(name)')
    .is('completed_at', null)
    .lte('due_at', todayEnd)
    .gte('due_at', staleFloor)
    .order('due_at', { ascending: true })
    .limit(30)
  if (scopeToSelf && crmSlug) tasksQuery.eq('assigned_broker', crmSlug)

  // 2b. Exact due-later-today count for the KPI tile — the limit(30) list
  // above undercounts once overdue + today together exceed the cap.
  const tasksTodayCountQuery = sb()
    .from('crm_tasks')
    .select('id', { count: 'exact', head: true })
    .is('completed_at', null)
    .gte('due_at', now.toISOString())
    .lte('due_at', todayEnd)
  if (scopeToSelf && crmSlug) tasksTodayCountQuery.eq('assigned_broker', crmSlug)

  // 3. Active clients — people you are ACTIVELY working, stalest touch first so
  //    the ones going cold surface for a reconnect. Scoped to stage 'Active
  //    Client' (the CRM's designation for a real working relationship). The old
  //    filter excluded only Closed/Lost/Archive — stages that do not exist here —
  //    so it surfaced the ~20k Nurture/Farm database as "active clients". There
  //    are ~12 genuine active clients; showing cold imports here was noise.
  const clientsQuery = sb()
    .from('crm_people')
    .select('id,name,stage,last_activity_at,assigned_broker,source,picture_url,tags')
    .eq('deleted', false)
    .eq('stage', 'Active Client')
    .order('last_activity_at', { ascending: true, nullsFirst: true })
    .limit(20)
  if (scopeToSelf && crmSlug) clientsQuery.eq('assigned_broker', crmSlug)

  // 4. Google Calendar (DWD) — the only external-network call on this
  // force-dynamic page, so it rides a short unstable_cache (5 min staleness is
  // fine for a dashboard month-strip; the Calendar page itself stays live).
  const loadGcal = broker.email
    ? unstable_cache(
        (brokerEmail: string) => getGcalEvents(brokerEmail),
        ['broker-command-center-gcal'],
        { revalidate: 300 },
      )(broker.email).catch(() => ({ connected: false, events: [] as GcalEvent[] }))
    : Promise.resolve({ connected: false, events: [] as GcalEvent[] })

  // 5. Listings feed the superuser-only marketing launchpad — skip the read
  // entirely for restricted brokers (the page never renders it for them).
  const loadListings = isSuperuser && brokerRow?.email
    ? sb()
        .from('listings')
        .select('"ListingKey","StreetNumber","StreetName","ListPrice","StandardStatus","PhotoURL"')
        .eq('"ListAgentEmail"', brokerRow.email)
        .in('"StandardStatus"', ['Active', 'Pending'])
        .order('"ListPrice"', { ascending: false })
        .limit(12)
    : Promise.resolve({ data: [] as Record<string, unknown>[] })

  // All seven branches are independent — one concurrent batch replaces what
  // was a strictly sequential ~8-round-trip waterfall (the dominant latency
  // source on the broker dashboard).
  const [activeDeals, tasksRes, tasksTodayRes, clientsRes, crmAppointments, gcalRes, listingsRes] =
    await Promise.all([
      loadDeals(),
      tasksQuery,
      tasksTodayCountQuery,
      clientsQuery,
      getAppointments({
        brokerScope: scopeToSelf ? (crmSlug ?? null) : null,
        from: apptFrom,
        to: apptTo,
      }).catch(() => []),
      loadGcal,
      loadListings,
    ])

  const tasksDue: CommandTask[] = (tasksRes.data ?? []).map((t: Record<string, unknown>) => {
    const personRow = t.crm_people as { name: string | null } | null
    return {
      id: t.id as number,
      name: t.name as string,
      dueAt: t.due_at as string | null,
      type: t.type as string | null,
      personName: personRow?.name ?? null,
      personId: t.person_id as number | null,
      isOverdue: t.due_at ? new Date(t.due_at as string) < now : false,
    }
  })

  const activeClients: CommandClient[] = (clientsRes.data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as number,
    name: c.name as string | null,
    stage: c.stage as string,
    lastActivityAt: c.last_activity_at as string | null,
    assignedBroker: c.assigned_broker as string | null,
    source: c.source as string | null,
    pictureUrl: c.picture_url as string | null,
    tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
  }))

  const { connected: gcalConnected, events: gcalEvents } = gcalRes

  // 5. Build calendar strip (TC dates + tasks + GCal events)
  const calendar: CalendarItem[] = []

  for (const deal of activeDeals) {
    if (deal.closingDate) {
      calendar.push({
        date: deal.closingDate,
        label: 'Closing',
        sublabel: deal.address,
        type: 'closing',
        href: `/admin/deals/${deal.propertyKey}`,
        gcalLink: null,
      })
    }
    if (deal.contractDate) {
      calendar.push({
        date: deal.contractDate,
        label: 'Contract accepted',
        sublabel: deal.address,
        type: 'contract',
        href: `/admin/deals/${deal.propertyKey}`,
        gcalLink: null,
      })
    }
  }

  for (const task of tasksDue) {
    if (task.dueAt) {
      calendar.push({
        date: task.dueAt.slice(0, 10),
        label: task.name,
        sublabel: task.personName ? `For ${task.personName}` : 'Task',
        type: 'task',
        href: task.personId ? `/admin/crm/${task.personId}` : '/admin/crm/tasks',
        gcalLink: null,
      })
    }
  }

  // CRM appointments → CalendarItem
  for (const appt of crmAppointments) {
    calendar.push({
      date: appt.startAt.slice(0, 10),
      label: appt.title,
      sublabel: appt.typeName ?? appt.personName ?? 'Appointment',
      type: 'gcal', // reuse 'gcal' type so MonthCalendar shows the 📅 icon
      href: '/admin/crm/calendar',
      gcalLink: null,
    })
  }

  for (const ev of gcalEvents) {
    calendar.push({
      date: ev.start.slice(0, 10),
      label: ev.title,
      sublabel: 'Google Calendar',
      type: 'gcal',
      href: ev.htmlLink,
      gcalLink: ev.htmlLink,
    })
  }

  calendar.sort((a, b) => a.date.localeCompare(b.date))

  const myListings: MarketingListing[] = ((listingsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    listingKey: r.ListingKey as string,
    address: `${r.StreetNumber ?? ''} ${r.StreetName ?? ''}`.trim(),
    listPrice: r.ListPrice as number | null,
    photoUrl: r.PhotoURL as string | null,
    status: r.StandardStatus as string,
  }))

  return {
    broker,
    activeDeals,
    tasksDue,
    tasksTodayCount: tasksTodayRes.count ?? tasksDue.filter((t) => !t.isOverdue).length,
    activeClients,
    calendar,
    gcalConnected,
    myListings,
    isSuperuser,
  }
}
