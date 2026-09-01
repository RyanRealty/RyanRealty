'use client'

/**
 * MessagesFolderSelect — the inbox folders as ONE compact control on Messages
 * (Matt lock 2026-09-01 #1: Messages is THE conversation surface; folder tools
 * fold in — surface bar rule 2, same idiom as VariantControl). "Recent" is the
 * fast default list; picking a folder switches the queue to the triage read.
 */
import { useRouter, useSearchParams } from 'next/navigation'
import { ToolbarSelect } from '@/components/admin/v2'

export const MESSAGE_FOLDERS = [
  ['recent', 'Recent'],
  ['inbox', 'Needs attention'],
  ['assigned', 'Assigned'],
  ['drafts', 'Drafts'],
  ['sent', 'Sent'],
  ['closed', 'Closed'],
] as const

export function MessagesFolderSelect({ current }: { current: string }) {
  const router = useRouter()
  const params = useSearchParams()
  return (
    <ToolbarSelect
      aria-label="Folder"
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString())
        if (e.target.value === 'recent') next.delete('f')
        else next.set('f', e.target.value)
        next.delete('c')
        const qs = next.toString()
        router.push(`/admin/messages${qs ? `?${qs}` : ''}`)
      }}
      style={{ width: '100%' }}
    >
      {MESSAGE_FOLDERS.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </ToolbarSelect>
  )
}
