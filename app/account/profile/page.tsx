import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getProfile } from '@/app/actions/profile'
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
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
      <p className="mt-1 text-muted-foreground">
        Update your display name and phone. Your email comes from your sign-in provider and cannot be changed here.
      </p>
      <ProfileForm
        initial={{
          displayName: displayName || undefined,
          phone: profile?.phone ?? undefined,
          email: email || undefined,
        }}
      />
    </>
  )
}
