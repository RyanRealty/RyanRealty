'use client'

/**
 * The text-message code step, for an envelope the broker set to ask for one
 * (lib/tc/sign-verify.ts). One button sends the code, one box takes it.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { checkSigningCode, sendSigningCode } from '@/app/actions/tc-sign'
import { CONTACT } from '@/lib/brand/contact'

export function SignCodeGate({
  token,
  recipientName,
  propertyAddress,
  maskedPhone,
  canText,
}: {
  token: string
  recipientName: string
  propertyAddress: string
  maskedPhone: string | null
  canText: boolean
}) {
  const router = useRouter()
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setBusy(true)
    setError(null)
    const r = await sendSigningCode(token)
    setBusy(false)
    if (r.ok) setSent(true)
    else setError(r.error ?? 'We could not send the code.')
  }

  async function check() {
    setBusy(true)
    setError(null)
    const r = await checkSigningCode(token, code)
    setBusy(false)
    if (r.ok) router.refresh()
    else setError(r.error ?? 'That code is not right.')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-foreground">Confirm it is you</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Hi {recipientName}. Before the documents for {propertyAddress} open, we text a code to your phone
        {maskedPhone ? ` ending ${maskedPhone.slice(-4)}` : ''}.
      </p>
      <Card className="mt-6 space-y-4 p-4">
        {!canText ? (
          <p className="text-sm text-muted-foreground">
            There is no mobile number on file for you, so we cannot send a code. Call {CONTACT.phoneDirect} and your broker will help.
          </p>
        ) : !sent ? (
          <Button className="w-full" onClick={send} disabled={busy}>
            {busy ? 'Sending…' : 'Text me a code'}
          </Button>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void check()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="sign-code">Code from the text</Label>
              <Input
                id="sign-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || code.length < 4}>
              {busy ? 'Checking…' : 'Open the documents'}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={send} disabled={busy}>
              Send a new code
            </Button>
          </form>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </Card>
    </div>
  )
}
