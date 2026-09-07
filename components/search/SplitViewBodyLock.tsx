'use client'

import { useEffect } from 'react'

/** Document scroll stays free so List/footer remain reachable. */
export function SplitViewBodyLock({ active }: { active: boolean }) {
  useEffect(() => {
    void active
  }, [active])
  return null
}
