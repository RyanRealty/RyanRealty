'use client'

/**
 * CRM SMS composer with a phone-style preview of exactly what will be sent.
 * Merge tokens are resolved server-side before the initial body lands here,
 * so the bubble shows the final text with real values.
 *
 * MergeFieldPicker added: click a chip to insert the token at cursor position
 * in the body textarea.
 */
import { useMemo, useRef, useState } from 'react'
import { findUnresolvedMergeTokens } from '@/lib/crm/merge'
import { MergeFieldPicker, insertAtCursor } from '@/components/admin/crm/MergeFieldPicker'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const { chars, segments } = segmentInfo(body)
  const unresolved = useMemo(() => findUnresolvedMergeTokens(body), [body])

  function handleInsertToken(token: string) {
    const el = bodyRef.current
    if (!el) {
      setBody((b) => b + token)
      return
    }
    const next = insertAtCursor(el, token)
    setBody(next)
    const pos = (el.selectionStart ?? 0) + token.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <form action={props.sendAction} className="space-y-2">
      <MergeFieldPicker channel="sms" onInsert={handleInsertToken} />
      <Textarea
        ref={bodyRef}
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
      {unresolved.length > 0 ? (
        <p className="text-xs font-medium text-warning">
          Unfilled merge fields, this contact has no value for: {unresolved.join(', ')}. Edit before sending.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox id="overrideQuietHours" name="overrideQuietHours" value="1" />
          <Label htmlFor="overrideQuietHours" className="text-xs font-normal text-muted-foreground">
            Send anyway (quiet hours)
          </Label>
        </div>
        <Button type="submit" size="sm">Send text</Button>
      </div>
    </form>
  )
}
