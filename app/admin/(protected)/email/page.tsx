// @no-parity — pure redirect, no UI (admin route, not a mockup surface)
import { redirect } from 'next/navigation'

/** /admin/email has no index of its own — compose is the job. */
export default function AdminEmailIndexPage() {
  redirect('/admin/email/compose')
}
