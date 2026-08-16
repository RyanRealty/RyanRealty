'use client'

import { useEffect } from 'react'
import { fireFirstPartyEvent } from '@/components/VisitTracker'

/**
 * /join CTAs: contact-form click is intent; a phone tap is the conversation.
 * Form submit writes join_convert server-side. This island only records the
 * click so the same visitor_events table the packet reads stays complete.
 */
export function JoinCtaTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const anchor = (event.target as HTMLElement | null)?.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (href.startsWith('tel:')) {
        fireFirstPartyEvent('join_convert', {
          pageCategory: 'join',
          metadata: { channel: 'phone', surface: 'join' },
        })
        return
      }
      if (href.includes('inquiry=Join')) {
        fireFirstPartyEvent('cta_click', {
          pageCategory: 'join',
          metadata: { channel: 'contact-cta', surface: 'join' },
        })
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])
  return null
}
