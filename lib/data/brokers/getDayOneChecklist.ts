import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { hasCapability, type AdminCapabilityContext } from '@/lib/admin/capabilities'
import {
  dayOneApplies,
  evaluateDayOne,
  type DayOneFacts,
  type DayOneItem,
} from '@/lib/crm/day-one'

export type DayOneChecklist = {
  applies: boolean
  items: DayOneItem[]
}

type BrokerDayOneRow = {
  display_name: string | null
  phone: string | null
  notify_new_leads: boolean | null
  notify_deal_activity: boolean | null
  notify_task_due: boolean | null
  notify_sms: boolean | null
  social_instagram: string | null
  social_facebook: string | null
  social_linkedin: string | null
}

function factsFromRow(
  ctx: AdminCapabilityContext,
  row: BrokerDayOneRow | null,
): DayOneFacts {
  return {
    role: ctx.role,
    brokerSlug: ctx.brokerSlug,
    displayName: row?.display_name ?? null,
    phone: row?.phone ?? null,
    notifyConfigured: Boolean(
      row &&
        (row.notify_new_leads != null ||
          row.notify_deal_activity != null ||
          row.notify_task_due != null ||
          row.notify_sms != null),
    ),
    socialUrls: [row?.social_instagram, row?.social_facebook, row?.social_linkedin],
    holdsMarketing: hasCapability(ctx, 'content.marketing'),
  }
}

/**
 * Day-one checklist for the signed-in admin. Superuser / report_viewer:
 * applies=false. Brokers get the six-item walk.
 */
export async function getDayOneChecklist(ctx: AdminCapabilityContext): Promise<DayOneChecklist> {
  if (!dayOneApplies(ctx.role)) {
    return { applies: false, items: [] }
  }

  const sb = createServiceClient()
  let row: BrokerDayOneRow | null = null
  if (ctx.brokerId) {
    const { data } = await sb
      .from('brokers')
      .select(
        'display_name,phone,notify_new_leads,notify_deal_activity,notify_task_due,notify_sms,social_instagram,social_facebook,social_linkedin',
      )
      .eq('id', ctx.brokerId)
      .maybeSingle()
    row = (data as BrokerDayOneRow | null) ?? null
  }
  if (!row && ctx.email) {
    const { data } = await sb
      .from('brokers')
      .select(
        'display_name,phone,notify_new_leads,notify_deal_activity,notify_task_due,notify_sms,social_instagram,social_facebook,social_linkedin',
      )
      .eq('email', ctx.email.trim().toLowerCase())
      .maybeSingle()
    row = (data as BrokerDayOneRow | null) ?? null
  }

  return { applies: true, items: evaluateDayOne(factsFromRow(ctx, row)) }
}
