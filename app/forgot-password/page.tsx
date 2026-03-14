import type { Metadata } from 'next'
import Link from 'next/link'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Send a password reset link to your email.',
  robots: 'noindex, follow',
}

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Link href="/" className="text-xl font-bold text-primary">
            Ryan Realty
          </Link>
        </div>
        <h1 className="text-center text-xl font-semibold text-foreground">Reset password</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a reset link
        </p>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-accent-foreground hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
