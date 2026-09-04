'use client'

/**
 * Always-on voice door in the chrome. Speaks plainly into parseSearchQuery
 * and lands on /homes-for-sale. One tap starts listening; a second tap stops.
 */
import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { searchHrefForQuery } from '@/lib/parse-search-query'
import { v3Text } from './atoms'

type RecCtor = new () => {
  start(): void
  stop(): void
  onstart: () => void
  onend: () => void
  onerror: () => void
  onresult: (e: { results?: Array<Array<{ transcript?: string }>> }) => void
  continuous: boolean
  interimResults: boolean
  lang: string
}

const LABEL_IDLE = v3Text('Find me')
const LABEL_ON = v3Text('Listening')

export function FindMeVoice({ className }: { className?: string }) {
  const router = useRouter()
  const recRef = useRef<{ stop(): void } | null>(null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const go = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text) return
      const href = searchHrefForQuery(text)
      router.push(href === '/homes-for-sale' ? `/homes-for-sale?keywords=${encodeURIComponent(text)}` : href)
    },
    [router],
  )

  const stop = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    setListening(false)
  }, [])

  const start = useCallback(() => {
    setError(null)
    const win = typeof window !== 'undefined' ? (window as unknown as { webkitSpeechRecognition?: RecCtor; SpeechRecognition?: RecCtor }) : null
    const Ctor = win?.webkitSpeechRecognition ?? win?.SpeechRecognition ?? null
    if (!Ctor) {
      setError('Voice search works in Safari or Chrome.')
      router.push('/homes-for-sale')
      return
    }
    const rec = new Ctor()
    recRef.current = rec
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onstart = () => setListening(true)
    rec.onend = () => {
      recRef.current = null
      setListening(false)
    }
    rec.onerror = () => {
      recRef.current = null
      setListening(false)
      setError('Could not hear you. Try again.')
    }
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript
      if (transcript) go(transcript)
    }
    rec.start()
  }, [go, router])

  return (
    <div className={className ? `${className} v3-chrome__findme-wrap` : 'v3-chrome__findme-wrap'}>
      <button
        type="button"
        className={listening ? 'v3-chrome__findme is-on' : 'v3-chrome__findme'}
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : 'Find me a home by voice'}
        onClick={listening ? stop : start}
      >
        <span className="v3-chrome__findme-mic" aria-hidden="true" />
        <span>{listening ? LABEL_ON : LABEL_IDLE}</span>
      </button>
      {error ? (
        <p className="v3-chrome__findme-err" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
