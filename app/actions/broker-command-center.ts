'use server'

import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getGcalEvents, type GcalEvent } from '@/lib/google-calendar'

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
  attention: {
    tasksOverdue: number
    tasksToday: number
    activeDeals: number
    docsNeedingSignoff: number
  }
  activeDeals: CommandDeal[]
  tasksDue: CommandTask[]
  activeClients: CommandClient[]
  calendar: CalendarItem[]
  gcalConnected: boolean
  gcalEvents: GcalEvent[]
  myListings: MarketingListing[]
  isSuperuser: boolean
}

export async function getBrokerCommandCenterData(): Promise<BrokerCommandCenterData | null> {
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

  // 1. Active TC deals (stage != closed)
  const dealsQuery = sb()
    .from('tc_deals')
    .select('id,property_key,address,city,stage,stage_detail,broker_name,fub_person_ids,created_at,updated_at')
    .neq('stage', 'closed')
    .order('updated_at', { ascending: false })
    .limit(20)

  // If not superuser, filter to this broker's deals
  const brokerDisplayName = brokerRow?.display_name
  if (!isSuperuser && brokerDisplayName) {
    dealsQuery.eq('broker_name', brokerDisplayName)
  }

  const { data: dealsRaw } = await dealsQuery

  // For each deal, get the most recent cycle's dates and checklist stats
  const activeDeals: CommandDeal[] = []
  if (dealsRaw && dealsRaw.length > 0) {
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
  }

  // 2. Tasks due (overdue + today)
  const now = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  const tasksQuery = sb()
    .from('crm_tasks')
    .select('id,name,type,due_at,assigned_broker,person_id,crm_people(name)')
    .is('completed_at', null)
    .lte('due_at', todayEnd)
    .order('due_at', { ascending: true })
    .limit(30)

  if (!isSuperuser && brokerDisplayName) {
    tasksQuery.eq('assigned_broker', isSuperuser ? 'matt' : (role.role === 'broker' ? (brokerRow?.slug ?? '') : ''))
  }

  const { data: tasksRaw } = await tasksQuery
  const tasksDue: CommandTask[] = (tasksRaw ?? []).map((t: Record<string, unknown>) => {
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

  // 3. Active clients (most in need of attention)
  const clientsQuery = sb()
    .from('crm_people')
    .select('id,name,stage,last_activity_at,assigned_broker,source,picture_url,tags')
    .not('stage', 'in', '("Closed","Lost","Archive")')
    .order('last_activity_at', { ascending: true, nullsFirst: true })
    .limit(20)

  if (!isSuperuser && brokerRow?.slug) {
    clientsQuery.eq('assigned_broker', brokerRow.slug)
  }

  const { data: clientsRaw } = await clientsQuery
  const activeClients: CommandClient[] = (clientsRaw ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as number,
    name: c.name as string | null,
    stage: c.stage as string,
    lastActivityAt: c.last_activity_at as string | null,
    assignedBroker: c.assigned_broker as string | null,
    source: c.source as string | null,
    pictureUrl: c.picture_url as string | null,
    tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
  }))

  // 4. Google Calendar events
  const { connected: gcalConnected, events: gcalEvents } = broker.id
    ? await getGcalEvents(broker.id).catch(() => ({ connected: false, events: [] }))
    : { connected: false, events: [] }

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

  // 6. Attention counts
  const overdueCount = tasksDue.filter((t) => t.isOverdue).length
  const todayCount = tasksDue.filter((t) => !t.isOverdue).length

  // Docs needing sign-off: tc_envelopes where status is 'sent' (awaiting signatures)
  const { count: envelopeCount } = await sb()
    .from('tc_envelopes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')

  // 7. My listings for marketing launchpad
  const { data: listingRows } = brokerRow?.email
    ? await sb()
        .from('listings')
        .select('"ListingKey","StreetNumber","StreetName","ListPrice","StandardStatus","PhotoURL"')
        .eq('"ListAgentEmail"', brokerRow.email)
        .in('"StandardStatus"', ['Active', 'Pending'])
        .order('"ListPrice"', { ascending: false })
        .limit(12)
    : { data: [] }

  const myListings: MarketingListing[] = (listingRows ?? []).map((r: Record<string, unknown>) => ({
    listingKey: r.ListingKey as string,
    address: `${r.StreetNumber ?? ''} ${r.StreetName ?? ''}`.trim(),
    listPrice: r.ListPrice as number | null,
    photoUrl: r.PhotoURL as string | null,
    status: r.StandardStatus as string,
  }))

  return {
    broker,
    attention: {
      tasksOverdue: overdueCount,
      tasksToday: todayCount,
      activeDeals: activeDeals.length,
      docsNeedingSignoff: envelopeCount ?? 0,
    },
    activeDeals,
    tasksDue,
    activeClients,
    calendar,
    gcalConnected,
    gcalEvents,
    myListings,
    isSuperuser,
  }
}
