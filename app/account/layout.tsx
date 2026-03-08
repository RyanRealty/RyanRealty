import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import WelcomeBanner from '@/components/WelcomeBanner'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) {
    redirect('/?next=' + encodeURIComponent('/account/buying-preferences'))
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <WelcomeBanner />
      <nav className="mb-8 flex flex-wrap gap-4 border-b border-zinc-200 pb-4" aria-label="Account">
        <Link href="/account" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">Dashboard</Link>
        <Link href="/account/profile" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">Profile</Link>
        <Link href="/account/saved-searches" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">Saved searches</Link>
        <Link href="/account/saved-homes" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">Saved homes</Link>
        <Link href="/account/saved-communities" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">Saved communities</Link>
        <Link href="/account/buying-preferences" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">Buying preferences</Link>
      </nav>
      {children}
    </div>
  )
}
