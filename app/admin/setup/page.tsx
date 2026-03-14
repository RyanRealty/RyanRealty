import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSetupComplete } from '@/app/actions/admin-setup'
import AdminSetupClient from '@/components/admin/AdminSetupClient'

export const metadata: Metadata = {
  title: 'Admin setup',
  description: 'First-run admin setup.',
  robots: 'noindex, nofollow',
}

export const dynamic = 'force-dynamic'

export default async function AdminSetupPage() {
  const complete = await getSetupComplete()
  if (complete) redirect('/admin')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="text-center text-xl font-semibold text-foreground">Admin setup</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Complete the steps below to finish setting up your admin portal.
        </p>
        <AdminSetupClient />
      </div>
    </main>
  )
}
