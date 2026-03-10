import type { Metadata } from 'next'
import Link from 'next/link'
import SignupForm from '@/components/auth/SignupForm'

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your Ryan Realty account.',
  robots: 'noindex, follow',
}

type Props = { searchParams: Promise<{ next?: string }> }

export default async function SignupPage({ searchParams }: Props) {
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
        <h1 className="text-center text-xl font-semibold text-zinc-900">Create account</h1>
        <p className="mt-1 text-center text-sm text-zinc-500">
          Save homes, get alerts, and stay in the loop
        </p>
        <SignupForm next={nextPath} />
        <p className="mt-6 text-center text-sm text-zinc-600">
          Already have an account?{' '}
          <Link href={`/login${nextPath !== '/dashboard' ? `?next=${encodeURIComponent(nextPath)}` : ''}`} className="font-medium text-[var(--accent)] hover:underline">
            Sign in
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
