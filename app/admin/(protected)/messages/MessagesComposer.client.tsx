'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, HiddenField } from '@/components/admin/v2'
import { sendMessagesSmsAction } from './actions'

export function MessagesComposer({
  personId,
  quiet,
  hasPhone,
}: {
  personId: number
  quiet: boolean
  hasPhone: boolean
}) {
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          const res = await sendMessagesSmsAction(formData)
          if (!res.ok) toast.error(res.error)
          else {
            toast.success('Text sent.')
            formRef.current?.reset()
          }
        })
      }}
    >
      <HiddenField name="personId" value={personId} />
      {quiet ? <HiddenField name="overrideQuietHours" value="1" /> : null}
      <div className="av2-composer__box">
        <textarea
          name="body"
          rows={2}
          required
          aria-label="Reply"
          placeholder={hasPhone ? 'Reply by text…' : 'No phone on file'}
          disabled={pending || !hasPhone}
        />
        <Button type="submit" touch disabled={pending || !hasPhone}>
          {pending ? 'Sending…' : 'Send'}
        </Button>
      </div>
      <div className="av2-composer__row">
        <span>Texts go through the business line. STOP and quiet hours still apply to leads.</span>
        <span className={quiet ? 'av2-composer__warn' : 'av2-composer__ok'}>
          {quiet ? 'Quiet hours — this tap is a manual 1:1 send' : 'Inside send window'}
        </span>
      </div>
    </form>
  )
}
