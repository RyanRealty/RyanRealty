// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/crm/automations — canonical entry point for the CRM automation editor.
 *
 * The primary implementation lives at /admin/crm/sequences (the full workflow
 * list + trigger rules manager + editor at /sequences/[id]/edit). This route
 * is the FUB-parity URL (/automations) that maps to the same surface.
 *
 * A permanent redirect keeps the canonical route stable while both paths work
 * for deep links and bookmarks.
 */

import { redirect } from 'next/navigation'

export const metadata = { title: 'Automations | CRM | Admin' }

export default function CrmAutomationsPage() {
  redirect('/admin/crm/sequences')
}
