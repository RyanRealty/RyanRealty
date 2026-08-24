import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { fileDeadlineMatchesScope } from '@/lib/tc/deal-scope'
import { slugFromBrokerName } from '@/lib/tc/deal-calendar'

export type TcTaskRow = {
  id: string
  deal_id: string | null
  cycle_id: string | null
  kind: string | null
  title: string
  detail: string | null
  assignee_email: string | null
  due_date: string | null
  status: 'open' | 'done' | 'cancelled'
  source: 'manual' | 'auto_deadline'
  completed_at: string | null
}

export async function listDealTasks(dealId: string): Promise<TcTaskRow[]> {
  const { data, error } = await createServiceClient()
    .from('tc_tasks')
    .select(
      'id, deal_id, cycle_id, kind, title, detail, assignee_email, due_date, status, source, completed_at',
    )
    .eq('deal_id', dealId)
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) {
    console.error('[listDealTasks]', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    deal_id: r.deal_id ? String(r.deal_id) : null,
    cycle_id: r.cycle_id ? String(r.cycle_id) : null,
    kind: r.kind == null ? null : String(r.kind),
    title: String(r.title ?? ''),
    detail: r.detail == null ? null : String(r.detail),
    assignee_email: r.assignee_email == null ? null : String(r.assignee_email),
    due_date: r.due_date == null ? null : String(r.due_date).slice(0, 10),
    status: r.status === 'done' ? 'done' : r.status === 'cancelled' ? 'cancelled' : 'open',
    source: r.source === 'auto_deadline' ? 'auto_deadline' : 'manual',
    completed_at: r.completed_at == null ? null : String(r.completed_at),
  }))
}

export type FileDeadlineRow = {
  id: string
  title: string
  dueDate: string
  brokerSlug: string | null
  propertyKey: string | null
}

/** Open Vault file clocks in a date window, scoped like Closings. */
export async function listFileDeadlineTasks(input: {
  from: string
  to: string
  brokerScope: string | null
}): Promise<FileDeadlineRow[]> {
  const { data, error } = await createServiceClient()
    .from('tc_tasks')
    .select('id, title, due_date, assignee_email, status, tc_deals(broker_name, property_key)')
    .eq('status', 'open')
    .gte('due_date', input.from)
    .lte('due_date', input.to)
    .order('due_date', { ascending: true })
    .limit(500)
  if (error) {
    console.error('[listFileDeadlineTasks]', error.message)
    return []
  }
  const out: FileDeadlineRow[] = []
  for (const r of data ?? []) {
    const deal = r.tc_deals as
      | { broker_name?: string | null; property_key?: string | null }
      | { broker_name?: string | null; property_key?: string | null }[]
      | null
    const row = Array.isArray(deal) ? deal[0] : deal
    const brokerName = row?.broker_name ?? null
    if (
      !fileDeadlineMatchesScope({
        dealBrokerName: brokerName,
        assigneeEmail: r.assignee_email == null ? null : String(r.assignee_email),
        brokerScope: input.brokerScope,
      })
    ) {
      continue
    }
    const due = r.due_date == null ? '' : String(r.due_date).slice(0, 10)
    if (!due) continue
    out.push({
      id: String(r.id),
      title: String(r.title ?? 'File deadline'),
      dueDate: due,
      brokerSlug: slugFromBrokerName(brokerName),
      propertyKey: row?.property_key ? String(row.property_key) : null,
    })
  }
  return out
}
