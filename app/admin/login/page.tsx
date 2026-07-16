import type { Metadata } from 'next'
import Link from 'next/link'
import AdminLoginForm from '@/components/admin/AdminLoginForm'

export const metadata: Metadata = {
  title: 'Admin sign in',
  description: 'Sign in to the Ryan Realty admin portal.',
  robots: 'noindex, nofollow',
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  // Web OAuth client id for Google One Tap (FedCM). Read server-side so it never
  // needs a NEXT_PUBLIC_ duplicate; passed to the client form below.
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || null
  // Preserve the post-auth destination the (protected) layout forwarded through
  // /auth-error → here, so a deep link survives sign-in (RC5). Admin-scoped only.
  const { next } = await searchParams
  const dest = next && next.startsWith('/admin') ? next : undefined
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Link href="/" className="text-xl font-bold text-primary">
            Ryan Realty
          </Link>
        </div>
        <h1 className="text-center text-lg font-semibold text-foreground">Admin Portal</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Sign in with your Ryan Realty Google account
        </p>
        <AdminLoginForm googleClientId={googleClientId} next={dest} />
      </div>
    </main>
  )
}
