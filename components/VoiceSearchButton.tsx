'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { Mic01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  onTranscript?: (text: string) => void
  className?: string
}

type SpeechResultEvent = { results?: Array<Array<{ transcript?: string }>> }

export default function VoiceSearchButton({ onTranscript, className }: Props) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Held so a second tap can cancel. The button used to be disabled={listening},
  // which left the only escape as waiting for the recognizer to time out (C-11).
  const recRef = useRef<{ stop(): void } | null>(null)
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
    rec.onresult = (e: SpeechResultEvent) => {
      const transcript = e.results?.[0]?.[0]?.transcript
      if (transcript) handleResult(transcript)
    }
    rec.start()
  }, [handleResult])

  const stopListening = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    setListening(false)
  }, [])

  return (
    // `display:contents` so the caller's className lands on the BUTTON, not on a
    // wrapper. It used to style this div: on the navy hero that meant `hs-mic`'s
    // transparent background + cream color hit an invisible box while the button
    // kept variant="outline" (bg-background, near-white) and the icon inherited
    // cream — a cream mic on a cream square, ~1.1:1 (C-11). The wrapper survives
    // only to carry the error message.
    <div style={{ display: 'contents' }}>
      <Button
        type="button"
        // outline keeps the bordered control the light surfaces expect (search
        // filter bar, sitting beside Newest / Save this search). The navy hero
        // overrides it through `.kb-root .hs-mic` — which only works now that the
        // class lands on the button rather than a wrapper (C-11).
        variant="outline"
        size="icon"
        onClick={listening ? stopListening : startListening}
        className={cn(
          'size-[length:var(--v3-tap)] min-h-[length:var(--v3-tap)] min-w-[length:var(--v3-tap)] shrink-0',
          className,
        )}
        aria-label={listening ? 'Stop listening' : 'Search by voice'}
        aria-pressed={listening}
      >
        {listening ? (
          <span className="size-4 animate-pulse rounded-full bg-destructive" />
        ) : (
          <HugeiconsIcon icon={Mic01Icon} className="size-5" />
        )}
      </Button>
      {/* absolute so an error cannot reflow the search row it sits inside */}
      {error && (
        <p className="absolute top-full left-0 mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
