/**
 * Drafts a cron wrote for Matt's per-issue approval.
 *
 * The monthly Bend Brief (cron:newsletter-monthly-draft) and the monthly market
 * report email (cron:market-report-edition:<YYYY-MM>) draft themselves and wait
 * on /admin/newsletters/<id>; nothing in them goes to anyone until Matt
 * approves that send (CLAUDE.md §1). The CRM's one-click "send the newsletter"
 * falls back to the newest draft when no issue has been sent, so it must skip
 * these: a broker sending a system draft would deliver an issue Matt has not
 * seen. A draft an admin composed by hand is theirs to send and stays eligible.
 *
 * Pure (no server-only import) so the send action, the send panel's lookup and
 * their tests share it.
 */
export const AUTO_DRAFT_PREFIX = 'cron:'

export function isAutoDraft(createdBy: string | null | undefined): boolean {
  return typeof createdBy === 'string' && createdBy.startsWith(AUTO_DRAFT_PREFIX)
}
