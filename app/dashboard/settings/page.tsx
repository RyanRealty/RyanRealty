import { redirect } from 'next/navigation'

// Consolidated onto /account (Option A). Settings split into Profile + Buying
// preferences, both reachable from the /account hub.
export default function Page() {
  redirect('/account/profile')
}
