'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import { replaceFormBlankPdf } from '@/app/actions/tc-library'
import { useRouter } from 'next/navigation'

export function ReplaceFormBlank({ formVersionId }: { formVersionId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  return (
    <form
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault()
        if (!file) {
          toast.error('Choose a PDF.')
          return
        }
        const data = new FormData()
        data.set('blank', file)
        start(async () => {
          const res = await replaceFormBlankPdf(formVersionId, data)
          if (res.error) toast.error(res.error)
          else {
            toast.success(`Blank saved · ${res.fields ?? 0} fields`)
            router.refresh()
          }
        })
      }}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        style={{ fontSize: 'var(--a-text-xs)', maxWidth: 140 }}
      />
      <Button type="submit" variant="quiet" disabled={pending || !file}>
        {pending ? 'Saving…' : 'Replace blank'}
      </Button>
    </form>
  )
}
