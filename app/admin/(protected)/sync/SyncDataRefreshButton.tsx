'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from "@/components/ui/button"

type Props = {
  className?: string
}

export default function SyncDataRefreshButton({ className }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    try {
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={
        `inline-flex items-center rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ` +
        (className ?? '')
      }
    >
      {pending ? 'Refreshing…' : 'Refresh data'}
    </Button>
  )
}

