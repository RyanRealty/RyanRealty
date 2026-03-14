'use client'

import { useRef } from 'react'
import { syncSparkListings } from '@/app/actions/sync-spark'
import SyncStatus from './SyncStatus'
import SyncHistoryStatus, { type SyncHistoryStatusHandle } from './SyncHistoryStatus'

export default function SyncSection() {
  const historyRef = useRef<SyncHistoryStatusHandle>(null)

  function handleListingSyncComplete() {
    historyRef.current?.startSync()
  }

  return (
    <>
      <div className="mt-8">
        <SyncStatus
          syncAction={syncSparkListings}
          onListingSyncComplete={handleListingSyncComplete}
        />
      </div>
      <div className="mt-10">
        <SyncHistoryStatus ref={historyRef} />
      </div>
    </>
  )
}
