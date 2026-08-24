import type { DealCalendarItem } from './deal-calendar'

const TASK_KINDS = new Set([
  'earnest_money_due',
  'executed_copies_due',
  'spds_revocation_ends',
  'principal_review_due',
  'well_contingency',
  'inspection_period_ends',
  'financing_contingency_ends',
])

export type AutoDeadlineTask = {
  kind: string
  title: string
  due_date: string
  cycleId: string | null
}

export function autoDeadlineTasksFromCalendar(
  items: readonly DealCalendarItem[],
): AutoDeadlineTask[] {
  return items
    .filter((i) => TASK_KINDS.has(i.kind) && i.date)
    .map((i) => ({
      kind: i.kind,
      title: i.title,
      due_date: i.date,
      cycleId: i.cycleId,
    }))
}
