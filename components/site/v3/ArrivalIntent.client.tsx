'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { fireFirstPartyEvent } from '@/components/VisitTracker'
import {
  classifyArrival,
  readLastThing,
  readPersistedIntent,
  setSessionFlag,
  hasSessionFlag,
  welcomeThing,
  RR_INTENT_DECLARED_KEY,
  RR_WELCOME_BACK_KEY,
  type DeclaredIntent,
  type LastThing,
} from '@/lib/site/arrival-intent'

type View = 'hidden' | 'welcome'

function readSessionIdentity(): { hasVisitor: boolean; hasPerson: boolean } {
  let hasVisitor = false
  let hasPerson = false
  try {
    if (sessionStorage.getItem('rr_vid') || sessionStorage.getItem('rr_session_id')) {
      hasVisitor = true
    }
  } catch {
    /* private mode */
  }
  try {
    if (/(?:^|; )rr_pid=/.test(document.cookie)) hasPerson = true
  } catch {
    /* ignore */
  }
  const q = new URLSearchParams(window.location.search)
  if (q.get('_pid') || q.get('_fuid')) hasPerson = true
  return { hasVisitor, hasPerson }
}

function fireDeclared(intent: DeclaredIntent, source: 'inbound' | 'unknown_direct' | 'tap') {
  if (hasSessionFlag(RR_INTENT_DECLARED_KEY)) return
  setSessionFlag(RR_INTENT_DECLARED_KEY)
  fireFirstPartyEvent('intent_declared', { metadata: { intent, source } })
}

function fireWelcome(thing: LastThing) {
  if (hasSessionFlag(RR_WELCOME_BACK_KEY)) return
  setSessionFlag(RR_WELCOME_BACK_KEY)
  fireFirstPartyEvent('welcome_back', {
    metadata: { thing: thing.kind, label: thing.label, href: thing.href },
  })
}

/**
 * Leftover arrival island. Not mounted on public `/` (Matt CHANGE 2026-08-16).
 * Buy/Sell/Look is not a nav. Do not remount this as a second bar. Do not
 * ship a modal. Intent declaration belongs on Google sign-on.
 */
export function ArrivalIntent() {
  const [view, setView] = useState<View>('hidden')
  const [thing, setThing] = useState<LastThing | null>(null)

  useEffect(() => {
    const { hasVisitor, hasPerson } = readSessionIdentity()
    const lastThing = readLastThing()
    const arrival = classifyArrival({
      referrer: document.referrer || '',
      href: window.location.href,
      lastThing,
      hasVisitor,
      hasPerson,
      declaredIntent: readPersistedIntent(),
    })

    if (arrival.kind === 'inbound') {
      fireDeclared(arrival.intent, 'inbound')
      setView('hidden')
      return
    }

    if (arrival.showWelcome && arrival.thing) {
      fireWelcome(arrival.thing)
      setThing(arrival.thing)
      setView('welcome')
      return
    }

    // Matt CHANGE 2026-08-16: Buy/Sell/Look is not a nav. Do not render a
    // second bar on first paint. Intent belongs on Google sign-on.
    setView('hidden')
  }, [])

  if (view === 'welcome' && thing) {
    const welcome = welcomeThing(thing)
    return (
      <p className={cn('px-4 py-3 text-sm text-muted-foreground')}>
        {welcome.line}{' '}
        <Link href={welcome.href} className="inline-flex h-11 items-center font-medium text-foreground underline underline-offset-4">
          {welcome.label}
        </Link>
      </p>
    )
  }

  return null
}
