// @no-parity — pure redirect, no UI (admin route, not a mockup surface)
import { redirect } from 'next/navigation'

/** /admin/visitors has no index of its own — the live view is the job. */
export default function AdminVisitorsIndexPage() {
  redirect('/admin/visitors/live')
}
