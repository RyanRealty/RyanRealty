'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function CloseReplyTasks(props: {
  ids: number[]
  completeTask: (taskId: number, formData: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (props.ids.length === 0) return null
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            for (const id of props.ids) {
              await props.completeTask(id, new FormData())
            }
            router.refresh()
          } catch {
            toast.error('Could not close the reply tasks')
          }
        })
      }
      style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
    >
      Close {props.ids.length === 1 ? 'it' : 'both'}
    </button>
  )
}