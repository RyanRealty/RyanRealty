'use client'
/**
 * Sarah launcher + listing-detail teaser.
 *
 * Bottom-end disc with the approved avatar. After ~30s on a listing detail
 * page only, a small teaser: desktop bubble with her photo and copy, phone
 * a badge on the disc. Never auto-opens the panel. Session dismiss.
 * prefers-reduced-motion is honored in CSS (duration tokens + a media query).
 */
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { usePathname } from 'next/navigation'
import { captureSarahLead } from '@/app/actions/sarah-capture'
import { getSarahDeskBroker } from '@/app/actions/sarah-desk'
import { mintSarahVoiceToken } from '@/app/actions/sarah-voice'
import { V3_ROOT_CLASS } from './atoms'
import { V3Icon } from './V3Icon'
import { SARAH_AVATAR_ALT, SARAH_AVATAR_SRC, SARAH_AVATAR_SRCSET } from '@/lib/sarah/assets'
import {
  deskBrokerFromAssigned,
  type SarahDeskBroker,
} from '@/lib/sarah/desk-broker'
import { evaluateSarahTurn } from '@/lib/sarah/guardrails'
import {
  applyIntentTurn,
  initialFlow,
  matchIntentChip,
  SARAH_INTENT_CHIPS,
  WEB_BRINGS_YOU_HERE_EN,
  type FlowChip,
  type FlowState,
} from '@/lib/sarah/intent-flow'
import {
  SARAH_NAME,
  WEB_HELP_EN,
  WEB_SAVED_NOTICE_EN,
  WEB_VOICE_NOTICE_EN,
  webGreetingEn,
} from '@/lib/sarah/scripts'
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
import {
  primeSarahMicrophone,
  startSarahVoiceSession,
  type SarahVoiceHandle,
  type SarahVoiceStatus,
} from '@/lib/sarah/web-voice'
import { shouldHidePublicChrome } from '@/lib/site/public-chrome-hide'
import { trackEvent } from '@/lib/tracking'
import './tokens.css'
import './V3SarahAssistant.css'

type ChatLine = { from: 'sarah' | 'visitor'; text: string; notice?: string }

function SarahHeadshot({ size, alt = '', className }: { size: number; alt?: string; className?: string }) {
  return (
    <img
      className={className}
      src={SARAH_AVATAR_SRC}
      srcSet={SARAH_AVATAR_SRCSET}
      sizes={`${size}px`}
      alt={alt}
      width={size}
      height={size}
      decoding="async"
    />
  )
}

function sessionStore(): Storage | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return sessionStorage
  } catch {
    return null
  }
}

function greetingLines(brokerFirst: string): ChatLine[] {
  return [
    { from: 'sarah', text: webGreetingEn(brokerFirst), notice: WEB_SAVED_NOTICE_EN },
    { from: 'sarah', text: WEB_BRINGS_YOU_HERE_EN },
  ]
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
  const [desk, setDesk] = useState<SarahDeskBroker>(() => deskBrokerFromAssigned(null))
  const [lines, setLines] = useState<ChatLine[]>(() => greetingLines(deskBrokerFromAssigned(null).firstName))
  const [flow, setFlow] = useState<FlowState>(() => initialFlow())
  const [chips, setChips] = useState<FlowChip[] | null>([...SARAH_INTENT_CHIPS])
  const [sheetDy, setSheetDy] = useState(0)
  const [voiceStatus, setVoiceStatus] = useState<SarahVoiceStatus>('idle')
  const [voiceKick, setVoiceKick] = useState(0)
  const shownRef = useRef(false)
  const dragRef = useRef<{ y: number; dy: number } | null>(null)
  const voiceRef = useRef<SarahVoiceHandle | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)
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
    setLines((prev) => {
      if (prev.length !== 2 || prev[0]?.from !== 'sarah' || prev[1]?.from !== 'sarah') return prev
      const next = greetingLines(desk.firstName)
      if (prev[0].text === next[0].text && prev[1].text === next[1].text) return prev
      return next
    })
  }, [desk.firstName])

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

  const scrollToLatest = useCallback(() => {
    const el = messagesRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    scrollToLatest()
  }, [lines, chips, panelOpen, scrollToLatest])

  const closePanel = useCallback(() => {
    setSheetDy(0)
    dragRef.current = null
    voiceRef.current?.stop()
    voiceRef.current = null
    setVoiceStatus('idle')
    setVoiceKick(0)
    setPanelOpen(false)
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, closePanel])

  const acceptVisitor = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const guard = evaluateSarahTurn({ visitorText: trimmed, greeted })
      setGreeted(true)
      const hardStop =
        guard.mode === 'wrap-has-agent' || guard.mode === 'stop-recording' || guard.mode === 'escalate'
      const intentHit = matchIntentChip(trimmed)
      if (hardStop || (guard.mode === 'refuse' && !intentHit && flow.step === 'intent')) {
        const reply =
          guard.reply ??
          (guard.mode === 'escalate'
            ? "I'll have a licensed broker call you as soon as possible. What's the best number?"
            : WEB_HELP_EN)
        setLines((prev) => [...prev, { from: 'visitor', text: trimmed }, { from: 'sarah', text: reply }])
        return
      }
      const turn = applyIntentTurn(flow, trimmed, desk.firstName)
      setFlow(turn.next)
      setChips(turn.chips)
      setLines((prev) => [...prev, { from: 'visitor', text: trimmed }, { from: 'sarah', text: turn.reply }])
      if (turn.capture) {
        void captureSarahLead({
          intent: turn.next.intent ?? 'question',
          answers: turn.next.answers,
          startCma: turn.startCma,
        })
      }
    },
    [desk.firstName, flow, greeted],
  )

  const send = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    acceptVisitor(text)
  }, [acceptVisitor, draft])

  const tapChip = useCallback(
    (label: string) => {
      trackEvent('click_cta', { cta: 'sarah_intent', action: label, surface: desk.slug })
      acceptVisitor(label)
    },
    [acceptVisitor, desk.slug],
  )

  const requestVoice = useCallback(() => {
    if (
      voiceStatus === 'listening' ||
      voiceStatus === 'connecting' ||
      voiceStatus === 'speaking' ||
      voiceStatus === 'asking'
    ) {
      voiceRef.current?.stop()
      voiceRef.current = null
      setVoiceStatus('idle')
      return
    }
    trackEvent('click_cta', { cta: 'sarah_voice', action: 'start', surface: desk.slug })
    setVoiceStatus('asking')
    setVoiceKick((n) => n + 1)
  }, [desk.slug, voiceStatus])

  useEffect(() => {
    if (voiceKick === 0) return
    let cancelled = false
    void (async () => {
      let stream: MediaStream | undefined
      try {
        stream = await primeSarahMicrophone()
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const token = await mintSarahVoiceToken()
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (!token.data) {
          stream.getTracks().forEach((t) => t.stop())
          setVoiceStatus('error')
          setLines((prev) => [...prev, { from: 'sarah', text: token.error ?? WEB_VOICE_NOTICE_EN }])
          return
        }
        const handle = await startSarahVoiceSession({
          secret: token.data.secret,
          brokerFirstName: token.data.brokerFirstName,
          stream,
          onStatus: setVoiceStatus,
          onError: (message) => {
            setLines((prev) => [...prev, { from: 'sarah', text: message }])
          },
          onTranscript: (from, text) => {
            setLines((prev) => [...prev, { from, text }])
          },
        })
        if (cancelled) {
          handle.stop()
          return
        }
        voiceRef.current = handle
      } catch {
        stream?.getTracks().forEach((t) => t.stop())
        if (!cancelled) {
          setVoiceStatus('error')
          setLines((prev) => [
            ...prev,
            { from: 'sarah', text: 'I need microphone permission to talk. You can keep typing.' },
          ])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [voiceKick])

  const onSheetPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (wide) return
      const handle = (e.target as HTMLElement).closest('[data-sarah-drag]')
      if (!handle) return
      dragRef.current = { y: e.clientY, dy: 0 }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [wide],
  )

  const onSheetPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return
    const dy = Math.max(0, e.clientY - dragRef.current.y)
    dragRef.current.dy = dy
    setSheetDy(dy)
  }, [])

  const onSheetPointerUp = useCallback(() => {
    if (!dragRef.current) return
    const dy = dragRef.current.dy
    dragRef.current = null
    if (dy > 96) {
      closePanel()
      return
    }
    setSheetDy(0)
  }, [closePanel])

  if (hidden) return null

  const showBubble = teaserOn && offer && teaserKind === 'bubble'
  const showBadge = teaserOn && offer && teaserKind === 'badge'
  const micBusy = voiceStatus === 'listening' || voiceStatus === 'connecting' || voiceStatus === 'speaking'
  const micLabel =
    voiceStatus === 'listening'
      ? 'Listening. Stop talking with Sarah'
      : voiceStatus === 'connecting' || voiceStatus === 'asking'
        ? 'Connecting to Sarah voice'
        : voiceStatus === 'speaking'
          ? 'Sarah is speaking. Stop voice'
          : 'Talk to Sarah'

  return (
    <div className={V3_ROOT_CLASS}>
      <div className="v3-sarah" data-sarah="root" data-sarah-open={panelOpen ? '1' : '0'}>
        {panelOpen && !wide ? (
          <button
            type="button"
            className="v3-sarah__scrim"
            aria-label="Close chat"
            data-sarah="scrim"
            onClick={closePanel}
          />
        ) : null}

        {panelOpen ? (
          <section
            className="v3-sarah__panel"
            data-sarah="panel"
            data-sarah-surface={wide ? 'card' : 'sheet'}
            data-sarah-broker={desk.slug}
            aria-labelledby={titleId}
            style={sheetDy ? { transform: `translateY(${sheetDy}px)` } : undefined}
            onPointerDown={onSheetPointerDown}
            onPointerMove={onSheetPointerMove}
            onPointerUp={onSheetPointerUp}
            onPointerCancel={onSheetPointerUp}
          >
            <div className="v3-sarah__sheet-handle" data-sarah-drag="">
              <span />
            </div>
            <div className="v3-sarah__panel-head" data-sarah-drag="">
              <SarahHeadshot size={32} />
              <div className="v3-sarah__panel-titles">
                <div className="v3-sarah__panel-name" id={titleId}>
                  {SARAH_NAME}
                </div>
                <span className="v3-sarah__panel-role">AI assistant</span>
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
            <div className="v3-sarah__messages" data-sarah="messages" ref={messagesRef}>
              {lines.map((line, i) => (
                <div
                  key={`${line.from}-${i}`}
                  className={
                    line.from === 'sarah' ? 'v3-sarah__msg v3-sarah__msg--sarah' : 'v3-sarah__msg v3-sarah__msg--visitor'
                  }
                >
                  {line.from === 'sarah' ? <SarahHeadshot size={28} /> : null}
                  <div className="v3-sarah__msg-stack">
                    <p className="v3-sarah__msg-body">{line.text}</p>
                    {line.notice ? (
                      <p className="v3-sarah__saved" data-sarah="saved-notice">
                        {line.notice}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {chips && chips.length > 0 ? (
              <div className="v3-sarah__hints" data-sarah="intent-chips">
                {flow.step === 'intent' ? (
                  <p className="v3-sarah__hints-kicker">Here&apos;s a starting point</p>
                ) : null}
                <div className="v3-sarah__hint-row">
                  {chips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className="v3-sarah__hint"
                      data-sarah-chip={chip.id}
                      onClick={() => tapChip(chip.label)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <form
              className="v3-sarah__composer"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <button
                type="button"
                className="v3-sarah__mic"
                aria-label={micLabel}
                data-sarah="mic"
                data-sarah-voice={voiceStatus}
                aria-pressed={micBusy}
                onClick={requestVoice}
              >
                <V3Icon name="Microphone" size={24} />
              </button>
              <input
                type="text"
                name="sarah-message"
                aria-label="Message Sarah"
                autoComplete="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={scrollToLatest}
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
                <SarahHeadshot size={36} />
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
          <SarahHeadshot className="v3-sarah__avatar" size={56} alt={SARAH_AVATAR_ALT} />
          {showBadge ? <span className="v3-sarah__badge" data-sarah-teaser="badge" /> : null}
        </button>
      </div>
    </div>
  )
}
