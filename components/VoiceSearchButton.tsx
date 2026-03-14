'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { Mic01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

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
        router.push(`/homes-for-sale/bend?keywords=${encodeURIComponent(t)}`)
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
      <Button
        type="button"
        onClick={startListening}
        disabled={listening}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-70"
        aria-label={listening ? 'Listening…' : 'Search by voice'}
      >
        {listening ? (
          <span className="h-4 w-4 animate-pulse rounded-full bg-destructive/100" />
        ) : (
          <HugeiconsIcon icon={Mic01Icon} className="h-5 w-5" />
        )}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
