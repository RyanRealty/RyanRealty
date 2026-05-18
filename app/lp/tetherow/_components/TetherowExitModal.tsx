'use client'

/**
 * Exit-intent modal. Triggers on mouseleave-top OR on mobile when the tab is
 * hidden after 60% scroll. Fires once per session. Ports the inline
 * exit-modal script from public/lp/tetherow/index.html.
 */
import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const SESSION_KEY = 'rr_tetherow_exit_modal_shown'

export function TetherowExitModal() {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const trigger = useCallback(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === '1') return
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* ignore — storage might be disabled */
    }
    setOpen(true)
  }, [])

  useEffect(() => {
    let armed = true
    let scrollPct = 0

    function onMouseLeave(e: MouseEvent) {
      if (!armed) return
      if (e.clientY <= 0) trigger()
    }
    function onScroll() {
      const doc = document.documentElement
      const scrollTop = window.scrollY || doc.scrollTop || 0
      const viewport = window.innerHeight || doc.clientHeight || 0
      const scrollable = (doc.scrollHeight || 0) - viewport
      if (scrollable <= 0) return
      scrollPct = Math.min(100, Math.round(((scrollTop + viewport) / (scrollable + viewport)) * 100))
    }
    function onVisibility() {
      if (!armed) return
      const isMobile = window.matchMedia('(max-width: 900px)').matches
      if (isMobile && document.hidden && scrollPct >= 60) trigger()
    }

    document.addEventListener('mouseleave', onMouseLeave)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      armed = false
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('scroll', onScroll)
    }
  }, [trigger])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const form = e.currentTarget
    const fd = new FormData(form)
    try {
      // Submit to the same generic /api/cma endpoint the seller LP uses — this
      // is a "soft" data-pack request so the canonical tag is buyer-intent-soft
      // / data-pack-only. The endpoint already tags exit-intent-capture from
      // the hidden field.
      await fetch('/api/cma', {
        method: 'POST',
        body: fd,
      }).catch(() => undefined)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[540px] gap-4 rounded-[18px] border-none bg-[color:var(--rr-cream)] p-9 shadow-[0_24px_80px_rgba(16,39,66,0.4)]">
        <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--rr-muted)]">
          Before you go
        </div>
        <DialogTitle
          className="font-display text-[30px] font-semibold leading-[1.15] tracking-[-0.012em] text-[color:var(--rr-navy)]"
          style={{ fontFamily: 'var(--rr-font-display)' }}
        >
          Want a 12-page Tetherow value report, but not ready to fill out a form?
        </DialogTitle>
        <DialogDescription className="text-[15px] leading-[1.6] text-[color:var(--rr-text)]">
          Leave us an email and we&apos;ll send the Tetherow sub-neighborhood data pack as a PDF.
          No phone call. No follow-up sequence. One email with the data, then you decide what you
          want next.
        </DialogDescription>
        {submitted ? (
          <div className="rounded-md bg-white p-4 text-[14px] text-[color:var(--rr-navy)]">
            Sent. Check your inbox in a few minutes for the data pack.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-[10px]">
            <input type="hidden" name="campaign" value="lp-tetherow-v1-exitintent" />
            <input type="hidden" name="resort" value="tetherow" />
            <input type="hidden" name="intent" value="seller-soft" />
            <input
              type="hidden"
              name="tags"
              value="seller-intent-soft,resort:tetherow,lp:tetherow-landing-v1,exit-intent-capture,data-pack-only"
            />
            <Input
              type="email"
              name="email"
              placeholder="Your email"
              required
              autoComplete="email"
              className="rounded-[10px] border border-[rgba(16,39,66,0.12)] bg-white px-4 py-3 text-[15px]"
            />
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-[10px] bg-[color:var(--rr-navy)] px-[22px] py-3 text-[15px] font-bold tracking-[0.02em] text-[color:var(--rr-cream)] hover:opacity-90"
            >
              {submitting ? 'Sending...' : 'Send me the data pack'}
            </Button>
            <div className="text-[11px] leading-[1.5] text-[color:var(--rr-muted)]">
              One email. No phone follow-up unless you reply.
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default TetherowExitModal
