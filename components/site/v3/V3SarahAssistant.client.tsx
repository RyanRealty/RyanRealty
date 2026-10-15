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
import { Mic } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { captureSarahLead } from '@/app/actions/sarah-capture'
import { answerSarahChat } from '@/app/actions/sarah-chat'
import { getSarahDeskBroker } from '@/app/actions/sarah-desk'
import { mintSarahVoiceToken } from '@/app/actions/sarah-voice'
import { V3_ROOT_CLASS } from './atoms'
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
  WEB_DISCLOSURE_LINE_EN,
  type FlowChip,
  type FlowState,
} from '@/lib/sarah/intent-flow'
import { listingUnknownFactEn, shouldAnswerFromPage } from '@/lib/sarah/listing-answer'
import {
  SARAH_NAME,
  WEB_HELP_EN,
  WEB_VOICE_NOTICE_EN,
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
import { startSarahVoiceSession, type SarahVoiceHandle, type SarahVoiceStatus } from '@/lib/sarah/web-voice'
import { shouldHidePublicChrome } from '@/lib/site/public-chrome-hide'
import { trackEvent } from '@/lib/tracking'
import './tokens.css'
import './V3SarahAssistant.css'

type ChatLine = { from: 'sarah' | 'visitor'; text: string; notice?: string }

function sessionStore(): Storage | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return sessionStorage
  } catch {
    return null
  }
}

function greetingLines(): ChatLine[] {
  return [{ from: 'sarah', text: WEB_BRINGS_YOU_HERE_EN, notice: WEB_DISCLOSURE_LINE_EN }]
}

function SarahFace({
  className,
  size,
  alt = '',
}: {
  className?: string
  size: number
  alt?: string
}) {
  return (
    <img
      className={className}
      src={SARAH_AVATAR_SRC}
      srcSet={SARAH_AVATAR_SRCSET}
      sizes={`${size}px`}
      alt={alt}
      width={size}
      height={size}
    />
  )
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
  const [lines, setLines] = useState<ChatLine[]>(() => greetingLines())
  const [flow, setFlow] = useState<FlowState>(() => initialFlow())
  const [chips, setChips] = useState<FlowChip[] | null>([...SARAH_INTENT_CHIPS])
  const [sheetDy, setSheetDy] = useState(0)
  const [voiceStatus, setVoiceStatus] = useState<SarahVoiceStatus>('idle')
  const shownRef = useRef(false)
  const dragRef = useRef<{ y: number; dy: number } | null>(null)
  const voiceRef = useRef<SarahVoiceHandle | null>(null)
  const flowRef = useRef(flow)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const latestRef = useRef<HTMLDivElement | null>(null)
  flowRef.current = flow
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

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const end = latestRef.current
    const box = messagesRef.current
    if (end && typeof end.scrollIntoView === 'function') {
      end.scrollIntoView({ block: 'end', behavior })
      return
    }
    if (box) box.scrollTop = box.scrollHeight
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    scrollToLatest(lines.length <= 1 ? 'auto' : 'smooth')
  }, [lines, chips, panelOpen, scrollToLatest])

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

  const launcherRef = useRef<HTMLButtonElement | null>(null)
  const closePanel = useCallback(() => {
    setSheetDy(0)
    dragRef.current = null
    voiceRef.current?.stop()
    voiceRef.current = null
    setVoiceStatus('idle')
    setPanelOpen(false)
    // UX review F17: closing returns focus to the button that opened it.
    requestAnimationFrame(() => launcherRef.current?.focus())
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
      if (
        shouldAnswerFromPage({
          pathname,
          visitorText: trimmed,
          flowStep: flowRef.current.step,
        })
      ) {
        setChips(null)
        setLines((prev) => [...prev, { from: 'visitor', text: trimmed }])
        void answerSarahChat({ pagePath: pathname ?? '', question: trimmed }).then((result) => {
          const reply = result.data?.reply ?? listingUnknownFactEn(desk.firstName)
          setLines((prev) => [...prev, { from: 'sarah', text: reply }])
        })
        return
      }
      const turn = applyIntentTurn(flowRef.current, trimmed, desk.firstName)
      setFlow(turn.next)
      flowRef.current = turn.next
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
    [desk.firstName, greeted, pathname],
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
    if (voiceStatus === 'listening' || voiceStatus === 'connecting' || voiceStatus === 'speaking') {
      voiceRef.current?.stop()
      voiceRef.current = null
      setVoiceStatus('idle')
      return
    }
    trackEvent('click_cta', { cta: 'sarah_voice', action: 'start', surface: desk.slug })
    setVoiceStatus('asking')
    setLines((prev) => {
      if (prev.some((line) => line.text === WEB_VOICE_NOTICE_EN)) return prev
      return [...prev, { from: 'sarah', text: WEB_VOICE_NOTICE_EN }]
    })
    void (async () => {
      const token = await mintSarahVoiceToken()
      if (!token.data) {
        setVoiceStatus('error')
        setLines((prev) => [...prev, { from: 'sarah', text: token.error ?? WEB_VOICE_NOTICE_EN }])
        return
      }
      try {
        const handle = await startSarahVoiceSession({
          secret: token.data.secret,
          brokerFirstName: token.data.brokerFirstName,
          onStatus: setVoiceStatus,
          onError: (message) => {
            setLines((prev) => [...prev, { from: 'sarah', text: message }])
          },
          onTranscript: (from, text) => {
            if (from === 'visitor') {
              acceptVisitor(text)
              return
            }
            setLines((prev) => [...prev, { from, text }])
          },
        })
        voiceRef.current = handle
      } catch {
        setVoiceStatus('error')
        setLines((prev) => [
          ...prev,
          { from: 'sarah', text: 'I need microphone permission to talk. You can keep typing.' },
        ])
      }
    })()
  }, [acceptVisitor, desk.slug, voiceStatus])

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
              <SarahFace size={36} />
              <div className="v3-sarah__panel-titles">
                <div className="v3-sarah__panel-name" id={titleId}>
                  {SARAH_NAME}
                </div>
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
            <div className="v3-sarah__messages" ref={messagesRef} data-sarah="messages">
              {lines.map((line, i) => (
                <div
                  key={`${line.from}-${i}`}
                  className={
                    line.from === 'sarah' ? 'v3-sarah__msg v3-sarah__msg--sarah' : 'v3-sarah__msg v3-sarah__msg--visitor'
                  }
                >
                  {line.from === 'sarah' ? <SarahFace size={28} /> : null}
                  <div className="v3-sarah__msg-stack">
                    <p className="v3-sarah__msg-body">{line.text}</p>
                    {line.notice ? (
                      <p className="v3-sarah__saved" data-sarah="saved-notice" data-sarah-disclosure="">
                        {line.notice}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
              <div ref={latestRef} data-sarah="latest" />
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
                <Mic aria-hidden="true" strokeWidth={1.75} />
                <span className="sr-only">{micLabel}</span>
              </button>
              <input
                type="text"
                name="sarah-message"
                aria-label="Message Sarah"
                autoComplete="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => scrollToLatest()}
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
                <SarahFace size={36} />
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
          ref={launcherRef}
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
          <SarahFace className="v3-sarah__avatar" size={56} alt={SARAH_AVATAR_ALT} />
          {showBadge ? <span className="v3-sarah__badge" data-sarah-teaser="badge" /> : null}
          {/* UX review F36: say "AI" on the button itself, so nobody takes the
              photo for one of the brokers before opening the chat. */}
          {!panelOpen ? <span className="v3-sarah__ai-tag" aria-hidden="true">AI</span> : null}
        </button>
      </div>
    </div>
  )
}
