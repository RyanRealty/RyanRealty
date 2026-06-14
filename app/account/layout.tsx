import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import WelcomeBanner from '@/components/WelcomeBanner'
import AccountNav from '@/components/account/AccountNav'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) {
    redirect('/?next=' + encodeURIComponent('/account/buying-preferences'))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <WelcomeBanner />
      <AccountNav />
      {children}
    </div>
  )
}
