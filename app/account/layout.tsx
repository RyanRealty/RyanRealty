import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import WelcomeBanner from '@/components/WelcomeBanner'
import AccountNav from '@/components/account/AccountNav'

// CR4: noindex the entire /account/* subtree — private user pages must never be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <WelcomeBanner />
      <AccountNav />
      {children}
    </div>
  )
}
