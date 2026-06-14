import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getProfile } from '@/app/actions/profile'
import { Card } from '@/components/ui/card'
import ProfileForm from './ProfileForm'

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Edit your profile and contact info at Ryan Realty.',
}

export default async function ProfilePage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const profile = await getProfile()
  const authName = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null
  const displayName = profile?.displayName ?? authName ?? ''
  const email = session.user.email ?? ''

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your display name and phone. Your email comes from your sign-in provider and cannot be changed here.
        </p>
      </header>

      {/* ── Profile details ── */}
      <section>
        <div className="mb-3 min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Your details</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">How we address you and reach you about your search.</p>
        </div>
        <Card className="max-w-xl p-6">
          <ProfileForm
            initial={{
              displayName: displayName || undefined,
              phone: profile?.phone ?? undefined,
              email: email || undefined,
            }}
          />
        </Card>
      </section>
    </div>
  )
}
