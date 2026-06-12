'use client'

/**
 * CRM SMS composer with a phone-style preview of exactly what will be sent.
 * Merge tokens are resolved server-side before the initial body lands here,
 * so the bubble shows the final text with real values.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

function segmentInfo(text: string): { chars: number; segments: number } {
  const gsm = /^[A-Za-z0-9 @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#%&'()*+,\-./:;<=>?¡ÄÖÑܧ¿äöñüà\n\r^{}\\[~\]|€]*$/.test(text)
  const chars = text.length
  if (chars === 0) return { chars: 0, segments: 0 }
  const single = gsm ? 160 : 70
  const multi = gsm ? 153 : 67
  return { chars, segments: chars <= single ? 1 : Math.ceil(chars / multi) }
}

export function SmsComposer(props: {
  initialBody: string
  sendAction: (formData: FormData) => Promise<void>
}) {
  const [body, setBody] = useState(props.initialBody)
  const { chars, segments } = segmentInfo(body)

  return (
    <form action={props.sendAction} className="space-y-2">
      <Textarea
        name="body"
        rows={4}
        placeholder="Message. Sends from Ryan Realty via Twilio."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {body.trim() ? (
        <div className="rounded-xl border border-border bg-muted/40 p-5">
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Exactly what sends</div>
          <div className="flex justify-end">
            <div className="max-w-xs whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm leading-snug text-primary-foreground">
              {body}
            </div>
          </div>
          <div className="mt-2 text-right text-xs tabular-nums text-muted-foreground">
            {chars} characters · {segments} {segments === 1 ? 'segment' : 'segments'}
          </div>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm">Send text</Button>
      </div>
    </form>
  )
}
