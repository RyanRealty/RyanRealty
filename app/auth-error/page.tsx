import Link from 'next/link'
import type { Metadata } from 'next'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Sign-in issue',
  description: 'There was a problem signing you in. Try again or return home.',
  alternates: { canonical: `${siteUrl}/auth-error` },
  robots: 'noindex, follow',
}

type Props = { searchParams: Promise<{ message?: string; next?: string }> }

export default async function AuthErrorPage({ searchParams }: Props) {
  const { message, next } = await searchParams
  const tryAgainHref =
    next && next.startsWith('/admin')
      ? `/admin/login${next !== '/admin' ? `?next=${encodeURIComponent(next)}` : ''}`
      : next && next.startsWith('/')
        ? `/?next=${encodeURIComponent(next)}`
        : '/'
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-foreground">Sign-in issue</h1>
      <p className="mt-2 text-muted-foreground">
        {message ? (() => { try { return decodeURIComponent(message) } catch { return message } })() : 'Something went wrong. Please try again.'}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        If you use Google sign-in, add <code className="rounded bg-muted px-1 text-xs break-all">{(process.env.NEXT_PUBLIC_SITE_URL || 'https://yoursite.com').replace(/\/$/, '')}/auth/callback</code> under Supabase → Authentication → URL Configuration → Redirect URLs.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={tryAgainHref}
          className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </Link>
        <Link
          href="/"
          className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
