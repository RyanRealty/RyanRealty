'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"

const COOKIE_NAME = 'pwa_install_dismissed'
const MIN_VISITS = 2
const MIN_TIME_MS = 30_000

function getDismissed(): boolean {
  if (typeof document === 'undefined') return true
  return document.cookie.includes(`${COOKIE_NAME}=1`)
}

function setDismissed(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=31536000`
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [ready, setReady] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<{ outcome: string }> } | null>(null)

  useEffect(() => {
    if (!isMobile() || getDismissed()) return

    const visits = parseInt(sessionStorage.getItem('pwa_visits') ?? '0', 10) + 1
    sessionStorage.setItem('pwa_visits', String(visits))

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as unknown as { prompt: () => Promise<{ outcome: string }> })
    }
    window.addEventListener('beforeinstallprompt', handler)

    const timer = setTimeout(() => setReady(true), MIN_TIME_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!deferredPrompt || !ready) return
    const visits = parseInt(sessionStorage.getItem('pwa_visits') ?? '0', 10)
    if (visits >= MIN_VISITS) setShow(true)
  }, [deferredPrompt, ready])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    try {
      const { outcome } = await deferredPrompt.prompt()
      if (outcome === 'accepted') setShow(false)
    } finally {
      setShow(false)
    }
  }

  const handleDismiss = () => {
    setDismissed()
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Install app"
      className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-border bg-card p-4 shadow-md sm:left-auto sm:right-4 sm:max-w-sm"
    >
      <p className="text-sm font-medium text-primary">
        Add Ryan Realty to your home screen for the fastest experience.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          onClick={handleInstall}
          className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        >
          Install
        </Button>
        <Button
          type="button"
          onClick={handleDismiss}
          className="rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          Not now
        </Button>
      </div>
    </div>
  )
}
