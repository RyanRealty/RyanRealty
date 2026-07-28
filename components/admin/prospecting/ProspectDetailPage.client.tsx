'use client'

/**
 * ProspectDetailPage — the client shell for /admin/prospecting/<kind>/<id>.
 *
 * Reuses the SAME ProspectDetailPanel the list's drawer renders (one detail
 * tree, no second copy to drift), and owns the pieces the drawer got from
 * ProspectingBoard: the build transition and the send dialog. Nothing here
 * re-implements a gate — every mutation is a server action passed in from the
 * route, and each one re-checks compliance live at click time.
 */

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import type { ProspectDetail, ProspectKind, SendIntroResult } from '@/lib/data/prospecting/types'
import { ProspectDetailPanel } from './ProspectDetailPanel.client'
import { ProspectSendDialog, type ProspectSendContext } from './ProspectSendDialog.client'

export function ProspectDetailPage({
  detail,
  buildAction,
  prepareSendAction,
  sendIntroAction,
  sendTestAction,
  approveAction,
}: {
  detail: ProspectDetail
  buildAction: (kind: ProspectKind, id: string) => Promise<{ ok: boolean; error?: string } | { ok: true; slug: string }>
  prepareSendAction: (
    kind: ProspectKind,
    id: string,
  ) => Promise<{ ok: true; context: ProspectSendContext } | { ok: false; error: string }>
  sendIntroAction: (
    kind: ProspectKind,
    id: string,
    args: { idempotencyKey: string; bodyOverride?: string | null },
  ) => Promise<SendIntroResult>
  sendTestAction: (args: { channel: 'sms' | 'email'; subject?: string; body: string }) => Promise<{ ok: boolean; error?: string }>
  approveAction: (slug: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ open: boolean; context: ProspectSendContext | null }>({ open: false, context: null })
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  const handleBuild = useCallback(
    (id: string) => {
      if (busy) return
      setBusy(true)
      startTransition(async () => {
        try {
          const res = await buildAction(detail.kind, id)
          if (res.ok) {
            toast.success('Audit build started.')
            router.refresh()
          } else {
            toast.error(res.error ?? 'Build failed.')
          }
        } finally {
          setBusy(false)
        }
      })
    },
    [busy, buildAction, detail.kind, router],
  )

  const openSend = useCallback(
    (id: string) => {
      if (busy) return
      setBusy(true)
      startTransition(async () => {
        try {
          const res = await prepareSendAction(detail.kind, id)
          if (res.ok) setDialog({ open: true, context: res.context })
          else toast.error(res.error ?? 'Could not open the send dialog.')
        } finally {
          setBusy(false)
        }
      })
    },
    [busy, prepareSendAction, detail.kind],
  )

  const handleApproveInDialog = useCallback(
    async (k: ProspectKind, id: string, slug: string): Promise<boolean> => {
      const res = await approveAction(slug)
      if (!res.ok) {
        toast.error(res.error ?? 'Approve failed.')
        return false
      }
      toast.success('Audit approved. The link is live.')
      const prep = await prepareSendAction(k, id)
      if (prep.ok) setDialog({ open: true, context: prep.context })
      router.refresh()
      return true
    },
    [approveAction, prepareSendAction, router],
  )

  return (
    <>
      <Card className="p-5 sm:p-6">
        <ProspectDetailPanel
          detail={detail}
          onBuild={handleBuild}
          onSend={openSend}
          onOpenSend={() => openSend(detail.id)}
        />
      </Card>

      <ProspectSendDialog
        open={dialog.open}
        onClose={() => {
          setDialog({ open: false, context: null })
          router.refresh()
        }}
        context={dialog.context}
        sendIntroAction={sendIntroAction}
        sendTestAction={sendTestAction}
        onApprove={handleApproveInDialog}
      />
    </>
  )
}
