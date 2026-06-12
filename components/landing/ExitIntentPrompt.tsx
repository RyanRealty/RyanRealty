'use client'

/**
 * ExitIntentPrompt — shared exit-intent overlay for LP pages.
 *
 * Desktop-only (matchMedia pointer:fine). Fires once per browser session
 * (sessionStorage guard). Triggers on document mouseleave toward the top
 * of the viewport (clientY < 8). Uses @/components/ui/dialog for focus-trap
 * and accessible dismiss. Respects prefers-reduced-motion.
 *
 * Props per page — voice-checked, no pressure copy, no banned vocab.
 */

import { useEffect, useState, useId, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const STORAGE_KEY = 'rr_exit_intent_shown_v1'

export type ExitIntentPromptProps = {
  /** Short headline — sentence case, no banned vocab. */
  headline: string
  /** Supporting copy — 1-2 sentences. */
  body: string
  /** Primary CTA label. */
  ctaLabel: string
  /**
   * Primary CTA target.
   * - A path string (e.g. '/housing-market') → renders a <Link>
   * - '#form-id'                               → scrolls to that element
   */
  ctaTarget: string
}

export default function ExitIntentPrompt({
  headline,
  body,
  ctaLabel,
  ctaTarget,
}: ExitIntentPromptProps) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const descId = useId()

  const dismiss = useCallback(() => {
    setOpen(false)
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Private-browsing storage may throw — ignore.
    }
  }, [])

  useEffect(() => {
    // Desktop-only: pointer-fine devices only (avoids firing on touch).
    if (typeof window === 'undefined') return
    const isPointerFine = window.matchMedia('(pointer: fine)').matches
    if (!isPointerFine) return

    // Once per session.
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return
    } catch {
      // Storage not available.
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let armed = false
    // Arm after 3 seconds so fast-bounce exits don't immediately trigger.
    const armTimer = setTimeout(() => {
      armed = true
    }, 3000)

    function handleMouseLeave(e: MouseEvent) {
      if (!armed) return
      // Trigger when the cursor exits toward the top of the viewport.
      if (e.clientY < 8) {
        try {
          if (sessionStorage.getItem(STORAGE_KEY)) return
          sessionStorage.setItem(STORAGE_KEY, '1')
        } catch {
          // ignore
        }
        // Small delay so the exit animation doesn't compete with page unload.
        const delay = reduceMotion ? 0 : 120
        setTimeout(() => setOpen(true), delay)
        document.removeEventListener('mouseleave', handleMouseLeave)
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      clearTimeout(armTimer)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  const isScrollTarget = ctaTarget.startsWith('#')

  function handleCtaClick() {
    dismiss()
    if (isScrollTarget) {
      const el = document.querySelector(ctaTarget)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss() }}>
      <DialogContent
        className="max-w-sm rounded-2xl border border-primary/15 bg-card p-7 shadow-lg"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <DialogHeader>
          <DialogTitle
            id={titleId}
            className="font-display text-xl font-semibold text-primary"
          >
            {headline}
          </DialogTitle>
          <DialogDescription
            id={descId}
            className="mt-2 text-base leading-relaxed text-foreground/80"
          >
            {body}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 flex flex-col gap-3">
          {isScrollTarget ? (
            <Button
              className="h-12 w-full rounded-xl text-base font-semibold"
              onClick={handleCtaClick}
            >
              {ctaLabel}
            </Button>
          ) : (
            <Button asChild className="h-12 w-full rounded-xl text-base font-semibold" onClick={dismiss}>
              <Link href={ctaTarget}>{ctaLabel}</Link>
            </Button>
          )}

          <Button
            variant="ghost"
            className="h-10 w-full rounded-xl text-sm text-muted-foreground hover:text-foreground"
            onClick={dismiss}
          >
            No thanks
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
