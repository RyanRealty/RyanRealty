'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"

const WELCOME_DISMISSED_KEY = 'ryan_realty_welcome_dismissed'

function getDismissed(): boolean {
  if (typeof document === 'undefined') return true
  try {
    return document.cookie.includes(`${WELCOME_DISMISSED_KEY}=1`)
  } catch {
    return true
  }
}

function setDismissed() {
  try {
    document.cookie = `${WELCOME_DISMISSED_KEY}=1; path=/; max-age=31536000; SameSite=Lax`
  } catch {
    // ignore
  }
}

export default function WelcomeBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(!getDismissed())
  }, [])

  function handleDismiss() {
    setDismissed()
    setShow(false)
  }

  if (!show) return null

  return (
    <Alert className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-success/10 border-success/30">
      <p className="text-sm font-medium text-success">
        Welcome to your account! Here you can manage your{' '}
        <Link href="/account/saved-searches" className="underline hover:no-underline">saved searches</Link>,{' '}
        <Link href="/account/saved-homes" className="underline hover:no-underline">saved homes</Link>,{' '}
        <Link href="/account/buying-preferences" className="underline hover:no-underline">buying preferences</Link>, and{' '}
        <Link href="/account/profile" className="underline hover:no-underline">profile</Link>.
      </p>
      <Button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-success hover:bg-success/15"
        aria-label="Dismiss welcome message"
      >
        Dismiss
      </Button>
    </Alert>
  )
}
