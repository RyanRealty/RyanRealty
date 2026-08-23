import { addBankingDays } from './banking-days'
import { BROKER_FILE_NAME, brokerEmailFromFileName } from './deal-scope'

export type DealCalendarItem = {
  kind: string
  date: string
  title: string
  cycleId: string | null
}

export function slugFromBrokerName(name: string | null | undefined): string | null {
  const n = (name ?? '').trim().toLowerCase()
  for (const [slug, fileName] of Object.entries(BROKER_FILE_NAME)) {
    if (fileName.toLowerCase() === n) return slug
  }
  return null
}

export function dealCalendarItems(input: {
  address: string
  cycles: ReadonlyArray<{
    id: string
    expiration_date?: string | null
    contract_acceptance_date?: string | null
    escrow_closing_date?: string | null
  }>
}): DealCalendarItem[] {
  const addr = input.address.trim() || 'Deal'
  const out: DealCalendarItem[] = []
  for (const c of input.cycles) {
    if (c.expiration_date) {
      out.push({
        kind: 'listing_expires',
        date: String(c.expiration_date).slice(0, 10),
        title: `Listing expires · ${addr}`,
        cycleId: c.id,
      })
    }
    if (c.contract_acceptance_date) {
      const accepted = String(c.contract_acceptance_date).slice(0, 10)
      out.push({
        kind: 'contract_accepted',
        date: accepted,
        title: `Contract accepted · ${addr}`,
        cycleId: c.id,
      })
      const start = new Date(`${accepted}T00:00:00Z`)
      if (!Number.isNaN(start.getTime())) {
        const due = addBankingDays(start, 7)
        out.push({
          kind: 'principal_review_due',
          date: due.toISOString().slice(0, 10),
          title: `Principal review due · ${addr}`,
          cycleId: c.id,
        })
      }
    }
    if (c.escrow_closing_date) {
      out.push({
        kind: 'escrow_closes',
        date: String(c.escrow_closing_date).slice(0, 10),
        title: `Closes · ${addr}`,
        cycleId: c.id,
      })
    }
  }
  return out
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function appointmentTypeId(sb: any): Promise<number | null> {
  const { data } = await sb
    .from('crm_appointment_types')
    .select('id')
    .eq('name', 'Transaction date')
    .maybeSingle()
  return data?.id ?? null
}

/** Write deal dates onto the in-app calendar and try Google Calendar (fail-open). */
export async function syncDealCalendar(dealId: string): Promise<{ synced: number }> {
  const { createServiceClient } = await import('@/lib/supabase/service')
  const { upsertAllDayGcalEvent } = await import('@/lib/google-calendar')
  const sb = createServiceClient()
  const { data: deal } = await sb
    .from('tc_deals')
    .select('id, address, broker_name, property_key')
    .eq('id', dealId)
    .maybeSingle()
  if (!deal) return { synced: 0 }
  const { data: cycles } = await sb
    .from('tc_cycles')
    .select('id, expiration_date, contract_acceptance_date, escrow_closing_date')
    .eq('deal_id', dealId)
  const items = dealCalendarItems({ address: String(deal.address ?? ''), cycles: cycles ?? [] })
  const dealSlug = slugFromBrokerName(deal.broker_name)
  const slugs = [...new Set([dealSlug, 'matt'].filter(Boolean))] as string[]
  const typeId = await appointmentTypeId(sb)
  let synced = 0
  for (const item of items) {
    for (const slug of slugs) {
      const email =
        Object.entries(BROKER_FILE_NAME).find(([s]) => s === slug)?.[1]
          ? brokerEmailFromFileName(BROKER_FILE_NAME[slug])
          : null
      const vaultKey = `tc:${dealId}:${item.kind}:${item.date}:${slug}`
      const { data: existing } = await sb
        .from('tc_calendar_sync')
        .select('id, crm_appointment_id, gcal_event_id')
        .eq('deal_id', dealId)
        .eq('kind', item.kind)
        .eq('date', item.date)
        .eq('broker_slug', slug)
        .maybeSingle()

      let apptId = existing?.crm_appointment_id ?? null
      if (!apptId && typeId) {
        const { data: appt, error } = await sb
          .from('crm_appointments')
          .insert({
            title: item.title,
            start_at: `${item.date}T00:00:00Z`,
            end_at: `${nextDay(item.date)}T00:00:00Z`,
            all_day: true,
            timezone: 'America/Los_Angeles',
            description: `Vault ${item.kind}`,
            type_id: typeId,
            broker_slug: slug,
            location: deal.address,
          })
          .select('id')
          .single()
        if (!error) apptId = appt?.id ?? null
      } else if (apptId) {
        await sb.from('crm_appointments').update({ title: item.title, start_at: `${item.date}T00:00:00Z`, end_at: `${nextDay(item.date)}T00:00:00Z` }).eq('id', apptId)
      }

      let gcalId = existing?.gcal_event_id ?? null
      if (email) {
        gcalId =
          (await upsertAllDayGcalEvent({
            brokerEmail: email,
            vaultKey,
            title: item.title,
            date: item.date,
            description: `https://ryan-realty.com/admin/deals/${encodeURIComponent(String(deal.property_key ?? ''))}`,
            existingEventId: gcalId,
          })) ?? gcalId
      }

      await sb.from('tc_calendar_sync').upsert(
        {
          deal_id: dealId,
          cycle_id: item.cycleId,
          kind: item.kind,
          date: item.date,
          broker_slug: slug,
          crm_appointment_id: apptId,
          gcal_event_id: gcalId,
          title: item.title,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'deal_id,kind,date,broker_slug' },
      )
      synced++
    }
  }
  return { synced }
}
