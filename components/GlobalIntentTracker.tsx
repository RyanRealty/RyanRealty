'use client'

/**
 * GlobalIntentTracker
 *
 * High-intent micro-event capture mounted once at app root. Fires GA4 events
 * for actions that the legacy trackers were dropping:
 *
 *   - `call_initiated`  → any click on a `tel:` anchor (mobile + desktop)
 *   - `email_agent`     → any click on a `mailto:` anchor
 *   - `form_start`      → first focus into a form's input (one event per form)
 *
 * These three are the strongest pre-submit intent signals on the site and
 * power the funnel breakpoint dashboard's "Form starters - no submit" cohort.
 *
 * Returns null. Side-effect-only on mount.
 */
import { useEffect } from 'react'
import { trackEvent } from '@/lib/tracking'

function findTelOrMailto(target: EventTarget | null): { kind: 'tel' | 'mailto'; href: string } | null {
  if (!(target instanceof Element)) return null
  const a = target.closest('a[href]') as HTMLAnchorElement | null
  if (!a) return null
  const href = a.getAttribute('href') || ''
  if (href.startsWith('tel:'))    return { kind: 'tel',    href }
  if (href.startsWith('mailto:')) return { kind: 'mailto', href }
  return null
}

export default function GlobalIntentTracker() {
  useEffect(() => {
    // ─── Tel + mailto click tracking ─────────────────────────────────────
    function onAnchorClick(e: MouseEvent) {
      try {
        const match = findTelOrMailto(e.target)
        if (!match) return
        const path = (typeof window !== 'undefined' ? window.location.pathname : '/') || '/'
        if (match.kind === 'tel') {
          // Strip the tel: prefix for the event params; keep raw href for analytics
          const number = match.href.replace(/^tel:/, '').trim()
          trackEvent('call_initiated', {
            phone_number: number.slice(0, 32),
            page_path: path,
            href: match.href.slice(0, 128),
          })
        } else {
          const email = match.href.replace(/^mailto:/, '').split('?')[0].trim()
          trackEvent('email_agent', {
            email_to: email.slice(0, 128),
            page_path: path,
            href: match.href.slice(0, 256),
          })
        }
      } catch {
        // Never let analytics block the page
      }
    }
    document.addEventListener('click', onAnchorClick, { capture: true })

    // ─── Form-start tracking ─────────────────────────────────────────────
    // Fires once per form, the first time any field inside it gets focus.
    // Uses a WeakSet so the form ref gets GC'd cleanly when removed from DOM.
    const seenForms = new WeakSet<HTMLFormElement>()
    function onFocus(e: FocusEvent) {
      try {
        const tgt = e.target
        if (!(tgt instanceof Element)) return
        // Only count inputs, textareas, and contenteditable focus
        const isField =
          tgt.tagName === 'INPUT' ||
          tgt.tagName === 'TEXTAREA' ||
          tgt.tagName === 'SELECT' ||
          (tgt as HTMLElement).isContentEditable
        if (!isField) return
        // Skip hidden + button + submit inputs
        const inputType = (tgt as HTMLInputElement).type?.toLowerCase()
        if (inputType === 'hidden' || inputType === 'button' || inputType === 'submit' || inputType === 'reset') return
        const form = (tgt as HTMLElement).closest('form') as HTMLFormElement | null
        if (!form) return
        if (seenForms.has(form)) return
        seenForms.add(form)
        // Best-effort form identifier
        const formId = form.id || form.getAttribute('name') || form.getAttribute('aria-label') || ''
        const formAction = form.getAttribute('action') || ''
        const path = (typeof window !== 'undefined' ? window.location.pathname : '/') || '/'
        trackEvent('form_start', {
          form_id: String(formId).slice(0, 64),
          form_action: String(formAction).slice(0, 128),
          page_path: path,
          first_field: ((tgt as HTMLInputElement).name || (tgt as HTMLElement).id || '').slice(0, 64),
        })
      } catch {
        // never block
      }
    }
    document.addEventListener('focusin', onFocus, { capture: true })

    return () => {
      document.removeEventListener('click', onAnchorClick, { capture: true } as EventListenerOptions)
      document.removeEventListener('focusin', onFocus, { capture: true } as EventListenerOptions)
    }
  }, [])

  return null
}
