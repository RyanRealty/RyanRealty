import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getProfile } from '@/app/actions/profile'
import DashboardShell from '@/components/dashboard/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent('/dashboard')}`)
  }

  const profile = await getProfile()
  const authName = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null
  const displayName = (profile?.displayName?.trim() || authName || session.user.email || 'there').split(/\s+/)[0]
  const firstName = displayName

  return (
    <DashboardShell
      user={{
        id: session.user.id,
        email: session.user.email ?? '',
        firstName,
        avatarUrl: session.user.avatar_url ?? session.user.user_metadata?.avatar_url ?? session.user.user_metadata?.picture ?? null,
      }}
    >
      {children}
    </DashboardShell>
  )
}
