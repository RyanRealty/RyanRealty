import Link from 'next/link'

type Props = { searchParams: Promise<{ message?: string; next?: string }> }

export default async function AuthErrorPage({ searchParams }: Props) {
  const { message, next } = await searchParams
  const tryAgainHref = next && next.startsWith('/') ? `/?next=${encodeURIComponent(next)}` : '/'
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Sign-in issue</h1>
      <p className="mt-2 text-zinc-600">
        {message ? (() => { try { return decodeURIComponent(message) } catch { return message } })() : 'Something went wrong. Please try again.'}
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        If you use Google sign-in, add <code className="rounded bg-zinc-100 px-1 text-xs break-all">{(process.env.NEXT_PUBLIC_SITE_URL || 'https://yoursite.com').replace(/\/$/, '')}/auth/callback</code> under Supabase → Authentication → URL Configuration → Redirect URLs.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={tryAgainHref}
          className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Try again
        </Link>
        <Link
          href="/"
          className="inline-block rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
