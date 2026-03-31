'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setSetupComplete } from '@/app/actions/admin-setup'
import { Button } from "@/components/ui/button"

export default function AdminSetupClient() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleComplete() {
    setError(null)
    setLoading(true)
    const result = await setSetupComplete()
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.refresh()
    router.push('/admin')
  }

  return (
    <div className="mt-6 space-y-6">
      {step === 1 && (
        <section>
          <h2 className="font-semibold text-foreground">Step 1: Admin account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ensure your admin account exists. Sign in at the main site or use the admin login page. Your email must be granted admin access (e.g. in admin_roles or as the designated superuser).
          </p>
          <Button
            type="button"
            onClick={() => setStep(2)}
            className="mt-3 rounded-lg bg-border px-4 py-2 text-sm font-medium text-foreground hover:bg-border"
          >
            Next
          </Button>
        </section>
      )}
      {step === 2 && (
        <section>
          <h2 className="font-semibold text-foreground">Step 2: Brokerage basics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure brokerage name and branding in Settings after setup.
          </p>
          <Button
            type="button"
            onClick={() => setStep(3)}
            className="mt-3 rounded-lg bg-border px-4 py-2 text-sm font-medium text-foreground hover:bg-border"
          >
            Next
          </Button>
        </section>
      )}
      {step === 3 && (
        <section>
          <h2 className="font-semibold text-foreground">Step 3: Complete</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;re all set! Welcome to your admin dashboard.
          </p>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            onClick={handleComplete}
            disabled={loading}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? 'Completing…' : 'Finish setup'}
          </Button>
        </section>
      )}
    </div>
  )
}
