import type { Metadata } from 'next'
import Link from 'next/link'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Ryan Realty account.',
  robots: 'noindex, follow',
}

type Props = { searchParams: Promise<{ next?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams
  const nextPath = next && next.startsWith('/') ? next : '/dashboard'

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Link href="/" className="text-xl font-bold text-[var(--brand-navy)]">
            Ryan Realty
          </Link>
        </div>
        <h1 className="text-center text-xl font-semibold text-zinc-900">Sign in</h1>
        <p className="mt-1 text-center text-sm text-zinc-500">
          Access your saved homes and searches
        </p>
        <LoginForm next={nextPath} />
        <p className="mt-6 text-center text-sm text-zinc-600">
          Don&apos;t have an account?{' '}
          <Link href={`/signup${nextPath !== '/dashboard' ? `?next=${encodeURIComponent(nextPath)}` : ''}`} className="font-medium text-[var(--accent)] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
      <p className="mt-4 text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">
          Back to home
        </Link>
      </p>
    </main>
  )
}
