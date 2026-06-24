'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

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

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS standalone: window.navigator.standalone === true
  // Android/desktop: display-mode media query
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIOSDevice, setIsIOSDevice] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<{
    prompt: () => Promise<{ outcome: string }>
  } | null>(null)

  useEffect(() => {
    if (!isMobile() || getDismissed() || isStandalone()) return

    const ios = isIOS()
    setIsIOSDevice(ios)

    const visits = parseInt(sessionStorage.getItem('pwa_visits') ?? '0', 10) + 1
    sessionStorage.setItem('pwa_visits', String(visits))

    if (ios) {
      // iOS Safari never fires beforeinstallprompt. Show manual instructions
      // (Share → Add to Home Screen) after the user has visited twice and
      // spent 30 s on the site.
      const timer = setTimeout(() => {
        const v = parseInt(sessionStorage.getItem('pwa_visits') ?? '0', 10)
        if (v >= MIN_VISITS) setShow(true)
      }, MIN_TIME_MS)
      return () => clearTimeout(timer)
    }

    // Android / Chromium: wait for the browser install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as unknown as { prompt: () => Promise<{ outcome: string }> })
    }
    window.addEventListener('beforeinstallprompt', handler)
    const timer = setTimeout(() => {
      const v = parseInt(sessionStorage.getItem('pwa_visits') ?? '0', 10)
      if (deferredPrompt && v >= MIN_VISITS) setShow(true)
    }, MIN_TIME_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!deferredPrompt) return
    const visits = parseInt(sessionStorage.getItem('pwa_visits') ?? '0', 10)
    if (visits >= MIN_VISITS) setShow(true)
  }, [deferredPrompt])

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
      {isIOSDevice ? (
        <>
          <p className="text-sm font-medium text-primary">
            Add Ryan Realty to your home screen for offline map access.
          </p>
          <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>1. Tap the <strong>Share</strong> button in Safari</li>
            <li>2. Tap <strong>Add to Home Screen</strong></li>
            <li>3. Tap <strong>Add</strong></li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            Once installed, maps load from cache when you are offline.
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleDismiss}
              className="text-sm"
            >
              Dismiss
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-primary">
            Add Ryan Realty to your home screen for the fastest experience.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={handleInstall} className="text-sm">
              Install
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDismiss}
              className="text-sm"
            >
              Not now
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
