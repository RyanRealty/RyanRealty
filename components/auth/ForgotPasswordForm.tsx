'use client'

import { useState } from 'react'
import { resetPasswordForEmail } from '@/app/actions/auth'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter your email')
      return
    }
    setLoading(true)
    const result = await resetPasswordForEmail(email.trim())
    setLoading(false)
    if (result.ok) {
      setSent(true)
      return
    }
    setError(result.error)
  }

  if (sent) {
    return (
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Check your email for a reset link. If you don&apos;t see it, check spam.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="forgot-email" className="block text-sm font-medium text-muted-foreground">
          Email
        </Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent/90 disabled:opacity-50"
      >
        {loading ? 'Sendingâ€¦' : 'Send reset link'}
      </Button>
    </form>
  )
}
