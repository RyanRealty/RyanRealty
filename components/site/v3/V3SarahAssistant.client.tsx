'use client'
/**
 * Sarah launcher + listing-detail teaser.
 *
 * Bottom-end disc with the approved avatar. After ~30s on a listing detail
 * page only, a small teaser: desktop bubble with her photo and copy, phone
 * a badge on the disc. Never auto-opens the panel. Session dismiss.
 * prefers-reduced-motion is honored in CSS (duration tokens + a media query).
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getSarahDeskBroker } from '@/app/actions/sarah-desk'
import { V3_ROOT_CLASS } from './atoms'
import { SARAH_AVATAR_ALT, SARAH_AVATAR_SRC } from '@/lib/sarah/assets'
import {
  brokerJoinedLine,
  deskBrokerFromAssigned,
  type SarahDeskBroker,
} from '@/lib/sarah/desk-broker'
import { evaluateSarahTurn } from '@/lib/sarah/guardrails'
import { SARAH_NAME, WEB_GREETING_EN, WEB_HELP_EN } from '@/lib/sarah/scripts'
import {
  SARAH_TEASER_COPY,
  SARAH_TEASER_DELAY_MS,
  SARAH_TEASER_WIDE_MQ,
  listingTeaserKind,
  persistTeaserDismissed,
  shouldOfferListingTeaser,
  teaserDismissedInSession,
  type SarahTeaserKind,
} from '@/lib/sarah/teaser'
import { shouldHidePublicChrome } from '@/lib/site/public-chrome-hide'
import { trackEvent } from '@/lib/tracking'
import './tokens.css'
import './V3SarahAssistant.css'

type ChatLine = { from: 'sarah' | 'visitor'; text: string }

function sessionStore(): Storage | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return sessionStorage
  } catch {
    return null
  }
}

export function V3SarahAssistant() {
  const pathname = usePathname()
  const hidden = shouldHidePublicChrome(pathname)
  const titleId = useId()
  const [panelOpen, setPanelOpen] = useState(false)
  const [wide, setWide] = useState(false)
  const [teaserOn, setTeaserOn] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [draft, setDraft] = useState('')
  const [greeted, setGreeted] = useState(true)
  const [lines, setLines] = useState<ChatLine[]>(() => [{ from: 'sarah', text: WEB_GREETING_EN }])
  const [desk, setDesk] = useState<SarahDeskBroker>(() => deskBrokerFromAssigned(null))
  const takeover = false
  const shownRef = useRef(false)
  const teaserKind: SarahTeaserKind = listingTeaserKind(wide)
  const offer = shouldOfferListingTeaser({
    pathname,
    dismissed,
    panelOpen,
  })

  useEffect(() => {
    setDismissed(teaserDismissedInSession(sessionStore()))
  }, [])

  useEffect(() => {
    let cancelled = false
    void getSarahDeskBroker().then((got) => {
      if (!cancelled && got.data) setDesk(got.data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(SARAH_TEASER_WIDE_MQ)
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!offer) {
      setTeaserOn(false)
      shownRef.current = false
      return
    }
    const id = window.setTimeout(() => setTeaserOn(true), SARAH_TEASER_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [offer, pathname])

  useEffect(() => {
    if (!teaserOn || !offer || shownRef.current) return
    shownRef.current = true
    trackEvent('sarah_teaser_shown', { surface: 'listing', cta: teaserKind })
  }, [teaserOn, offer, teaserKind])

  const dismissTeaser = useCallback(() => {
    persistTeaserDismissed(sessionStore())
    setDismissed(true)
    setTeaserOn(false)
  }, [])

  const openPanel = useCallback(
    (fromTeaser: boolean) => {
      if (fromTeaser) {
        trackEvent('sarah_teaser_clicked', { surface: 'listing', cta: teaserKind })
        dismissTeaser()
      }
      setPanelOpen(true)
    },
    [dismissTeaser, teaserKind],
  )

  const closePanel = useCallback(() => setPanelOpen(false), [])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, closePanel])

  const send = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    const turn = evaluateSarahTurn({ visitorText: text, greeted })
    setGreeted(true)
    const reply =
      turn.reply ??
      (turn.mode === 'escalate'
        ? "I'll have a licensed broker call you as soon as possible. What's the best number?"
        : WEB_HELP_EN)
    setLines((prev) => [...prev, { from: 'visitor', text }, { from: 'sarah', text: reply }])
  }, [draft, greeted])

  if (hidden) return null

  const showBubble = teaserOn && offer && teaserKind === 'bubble'
  const showBadge = teaserOn && offer && teaserKind === 'badge'

  return (
    <div className={V3_ROOT_CLASS}>
      <div className="v3-sarah" data-sarah="root">
        {panelOpen ? (
          <section
            className="v3-sarah__panel"
            data-sarah="panel"
            aria-labelledby={titleId}
          >
            <div className="v3-sarah__panel-head">
              <img src={SARAH_AVATAR_SRC} alt="" width={32} height={32} />
              <div>
                <div className="v3-sarah__panel-name" id={titleId}>
                  {SARAH_NAME}
                </div>
                <span className="v3-sarah__panel-role">AI assistant, not a licensed broker</span>
              </div>
              <button
                type="button"
                className="v3-sarah__dismiss"
                aria-label="Close chat"
                onClick={closePanel}
              >
                ×
              </button>
            </div>
            <div className="v3-sarah__messages">
              {lines.map((line, i) => (
                <div
                  key={`${line.from}-${i}`}
                  className={
                    line.from === 'sarah' ? 'v3-sarah__msg v3-sarah__msg--sarah' : 'v3-sarah__msg v3-sarah__msg--visitor'
                  }
                >
                  {line.from === 'sarah' ? (
                    <img src={SARAH_AVATAR_SRC} alt="" width={28} height={28} />
                  ) : null}
                  <p className="v3-sarah__msg-body">{line.text}</p>
                </div>
              ))}
            </div>
            <div className="v3-sarah__desk" data-sarah="desk" data-sarah-broker={desk.slug} data-sarah-takeover={takeover ? '1' : '0'}>
              <p className="v3-sarah__desk-who">
                <img src={desk.photoSrc} alt="" width={28} height={28} />
                <span data-sarah="desk-line">
                  {takeover ? brokerJoinedLine(desk) : `Your broker is ${desk.fullName}`}
                </span>
              </p>
              <nav className="v3-sarah__desk-actions" aria-label={`Reach ${desk.fullName}`}>
                <a
                  href={`tel:${desk.phoneTel}`}
                  onClick={() => trackEvent('click_cta', { cta: 'sarah_desk', action: 'call', surface: desk.slug })}
                >
                  Call
                </a>
                <a
                  href={`sms:${desk.phoneTel}`}
                  onClick={() => trackEvent('click_cta', { cta: 'sarah_desk', action: 'text', surface: desk.slug })}
                >
                  Text
                </a>
                <a
                  href={desk.contactHref}
                  onClick={() => trackEvent('click_cta', { cta: 'sarah_desk', action: 'message', surface: desk.slug })}
                >
                  Message
                </a>
              </nav>
            </div>
            <form
              className="v3-sarah__composer"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <input
                type="text"
                name="sarah-message"
                aria-label="Message Sarah"
                autoComplete="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit">Send</button>
            </form>
          </section>
        ) : null}

        {showBubble ? (
          <div className="v3-sarah__teaser" data-sarah-teaser="bubble" role="status">
            <button
              type="button"
              className="v3-sarah__teaser-open"
              onClick={() => openPanel(true)}
            >
              <span className="v3-sarah__teaser-photo">
                <img src={SARAH_AVATAR_SRC} alt="" width={36} height={36} />
              </span>
              <span>{SARAH_TEASER_COPY}</span>
            </button>
            <button
              type="button"
              className="v3-sarah__dismiss"
              aria-label="Dismiss"
              data-sarah-teaser-dismiss=""
              onClick={dismissTeaser}
            >
              ×
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className="v3-sarah__launcher"
          data-sarah="launcher"
          aria-label={
            showBadge
              ? `${SARAH_TEASER_COPY} Chat with Sarah, Ryan Realty AI assistant`
              : panelOpen
                ? 'Close chat with Sarah'
                : 'Chat with Sarah, Ryan Realty AI assistant'
          }
          aria-expanded={panelOpen}
          onClick={() => {
            if (panelOpen) closePanel()
            else openPanel(showBadge)
          }}
        >
          <img className="v3-sarah__avatar" src={SARAH_AVATAR_SRC} alt={SARAH_AVATAR_ALT} width={56} height={56} />
          {showBadge ? <span className="v3-sarah__badge" data-sarah-teaser="badge" /> : null}
        </button>
      </div>
    </div>
  )
}
