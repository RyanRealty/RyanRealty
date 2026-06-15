// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'

/**
 * The CRM contact detail is now the Lead Command Center
 * (app/admin/console/leads/[id]) — the curated, gold-standard surface (Matt
 * directive 2026-06-15). Every entry point that linked to /admin/crm/[id]
 * (the contacts list, broker dashboard, search, command palette, bookmarks)
 * lands on the command center via this redirect. The command center is a strict
 * superset of the old detail (identity, source, owned home, watching, saved
 * searches, conversation, comms with preview, workflow, tasks, details).
 */
export const dynamic = 'force-dynamic'

export default async function CrmPersonRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/console/leads/${id}`)
}
