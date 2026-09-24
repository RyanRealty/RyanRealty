import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getClientIdentity, hasClientDeals } from '@/lib/data/tc/client-transactions'
import WelcomeBanner from '@/components/WelcomeBanner'
import AccountNav from '@/components/account/AccountNav'

// CR4: noindex the entire /account/* subtree — private user pages must never be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Whether the signed-in visitor has at least one linked transaction file —
 * drives the Transactions nav tab. Cheap (identity lookup + one deal-links
 * query, no deal reads) and fail-safe: any error just hides the tab rather than breaking
 * the account shell every other /account page depends on.
 */
async function hasClientTransactions(): Promise<boolean> {
  try {
    const identity = await getClientIdentity()
    if (!identity) return false
    return await hasClientDeals(identity)
  } catch {
    return false
  }
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) {
    // F6: redirect to /login with the actual requested path as `next` so users
    // return to their intended destination after signing in.
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') ?? '/account'
    redirect('/login?next=' + encodeURIComponent(pathname))
  }

  const hasTransactions = await hasClientTransactions()

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-10">
        <WelcomeBanner />
        <AccountNav hasTransactions={hasTransactions} />
      </div>
      {children}
    </>
  )
}
