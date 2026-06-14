import { redirect } from 'next/navigation'

// Consolidated onto /account (Option A). Liked homes are merged into the saved-
// homes view, so this lives at /account/saved-homes now.
export default function Page() {
  redirect('/account/saved-homes')
}
