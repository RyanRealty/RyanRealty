'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  onTranscript?: (text: string) => void
  className?: string
}

type SpeechResultEvent = { results?: Array<Array<{ transcript?: string }>> }

export default function VoiceSearchButton({ onTranscript, className }: Props) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleResult = useCallback(
    (text: string) => {
      const t = text?.trim()
      if (!t) return
      setError(null)
      if (onTranscript) {
        onTranscript(t)
      } else {
        router.push(`/search/bend?keywords=${encodeURIComponent(t)}`)
      }
    },
    [onTranscript, router]
  )

  const startListening = useCallback(() => {
    setError(null)
    type SpeechRecognitionCtor = new () => { start(): void; stop(): void; onstart: () => void; onend: () => void; onerror: () => void; onresult: (e: { results?: Array<Array<{ transcript?: string }>> }) => void; continuous: boolean; interimResults: boolean; lang: string }
    const win = typeof window !== 'undefined' ? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor; SpeechRecognition?: SpeechRecognitionCtor }) : null
    const SpeechRecognition = win?.webkitSpeechRecognition ?? win?.SpeechRecognition ?? null
    if (!SpeechRecognition) {
      setError('Voice search is not supported in this browser.')
      return
    }
    const rec = new SpeechRecognition()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = () => {
      setListening(false)
      setError('Could not hear you. Try again.')
    }
    rec.onresult = (e: SpeechResultEvent) => {
      const transcript = e.results?.[0]?.[0]?.transcript
      if (transcript) handleResult(transcript)
    }
    rec.start()
  }, [handleResult])

  return (
    <div className={className}>
      <button
        type="button"
        onClick={startListening}
        disabled={listening}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-70"
        aria-label={listening ? 'Listening…' : 'Search by voice'}
      >
        {listening ? (
          <span className="h-4 w-4 animate-pulse rounded-full bg-rose-500" />
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v0m0 0v7m0-7a7 7 0 017-7" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
          </svg>
        )}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
