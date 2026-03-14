'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  runInProgress: boolean
}

const REFRESH_INTERVAL_MS = 60000

export default function SyncAutoRefresh({ runInProgress }: Props) {
  const router = useRouter()

  useEffect(() => {
    if (!runInProgress) return
    const id = setInterval(() => {
      router.refresh()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [runInProgress, router])

  return null
}

