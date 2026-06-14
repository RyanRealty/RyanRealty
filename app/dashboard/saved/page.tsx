import { redirect } from 'next/navigation'

// Consolidated onto /account (Option A).
export default function Page() {
  redirect('/account/saved-homes')
}
