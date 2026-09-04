'use client'

/**
 * Voice search as a listening stage, not a chrome chip.
 * One tap opens the stage and starts listening. Words go through
 * parseSearchQuery onto /homes-for-sale. Type if the browser has no speech.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { searchHrefForQuery } from '@/lib/parse-search-query'
import { v3Text } from './atoms'

type RecCtor = new () => {
  start(): void
  stop(): void
  abort?: () => void
  onstart: () => void
  onend: () => void
  onerror: () => void
  onresult: (e: {
    results?: Array<Array<{ transcript?: string }> & { isFinal?: boolean }>
  }) => void
  continuous: boolean
  interimResults: boolean
  lang: string
}

function speechCtor(): RecCtor | null {
  if (typeof window === 'undefined') return null
  const win = window as unknown as { webkitSpeechRecognition?: RecCtor; SpeechRecognition?: RecCtor }
  return win.webkitSpeechRecognition ?? win.SpeechRecognition ?? null
}

export function FindMeVoice({ className }: { className?: string }) {
  const router = useRouter()
  const recRef = useRef<{ stop(): void; abort?: () => void } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const go = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text) return
      recRef.current?.stop()
      recRef.current = null
      setListening(false)
      setOpen(false)
      const href = searchHrefForQuery(text)
      router.push(href === '/homes-for-sale' ? `/homes-for-sale?keywords=${encodeURIComponent(text)}` : href)
    },
    [router],
  )

  const halt = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    setListening(false)
  }, [])

  const listen = useCallback(() => {
    setError(null)
    const Ctor = speechCtor()
    if (!Ctor) {
      setError('Voice works in Safari or Chrome. Type it instead.')
      inputRef.current?.focus()
      return
    }
    recRef.current?.stop()
    const rec = new Ctor()
    recRef.current = rec
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onstart = () => setListening(true)
    rec.onend = () => {
      recRef.current = null
      setListening(false)
    }
    rec.onerror = () => {
      recRef.current = null
      setListening(false)
      setError('Could not hear you. Type it, or try again.')
    }
    rec.onresult = (e) => {
      const rows = e.results ?? []
      const last = rows[rows.length - 1]
      const text = last?.[0]?.transcript?.trim() ?? ''
      if (!text) return
      setDraft(text)
      if (last?.isFinal) go(text)
    }
    rec.start()
  }, [go])

  const close = useCallback(() => {
    halt()
    setOpen(false)
    setDraft('')
    setError(null)
  }, [halt])

  const openStage = useCallback(() => {
    setOpen(true)
    setError(null)
    listen()
  }, [listen])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const prior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prior
    }
  }, [open, close])

  useEffect(() => () => recRef.current?.stop(), [])

  return (
    <div className={className ? `${className} v3-chrome__findme-wrap` : 'v3-chrome__findme-wrap'}>
      <button
        type="button"
        className={open ? 'v3-chrome__findme is-on' : 'v3-chrome__findme'}
        aria-pressed={open}
        aria-expanded={open}
        aria-controls={uid}
        aria-label="Find me a home"
        onClick={open ? close : openStage}
      >
        <svg className="v3-chrome__findme-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z"
          />
        </svg>
      </button>
      {open ? (
        <div className="v3-findme-stage" id={uid} role="dialog" aria-modal="true" aria-labelledby={`${uid}-h`}>
          <button type="button" className="v3-findme-stage__scrim" aria-label="Close" onClick={close} />
          <div className="v3-findme-stage__panel">
            <p className="v3-findme-stage__eyebrow">{v3Text('Find me a home')}</p>
            <h2 id={`${uid}-h`} className="v3-findme-stage__title">
              {listening ? 'Listening.' : 'Say the house.'}
            </h2>
            <p className="v3-findme-stage__hint">Three bed under 800 in Tetherow</p>
            <form
              className="v3-findme-stage__form"
              onSubmit={(event) => {
                event.preventDefault()
                go(draft)
              }}
            >
              <label className="v3-findme-stage__label" htmlFor={`${uid}-q`}>
                Search
              </label>
              <input
                ref={inputRef}
                id={`${uid}-q`}
                className="v3-findme-stage__input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={listening ? 'Listening' : 'Or type it'}
                autoComplete="off"
              />
              <div className="v3-findme-stage__row">
                <button type="submit" className="v3-findme-stage__go" disabled={!draft.trim()}>
                  Search
                </button>
                <button
                  type="button"
                  className="v3-findme-stage__mic"
                  onClick={listening ? halt : listen}
                >
                  {listening ? 'Stop' : 'Listen'}
                </button>
              </div>
            </form>
            {error ? (
              <p className="v3-findme-stage__err" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
