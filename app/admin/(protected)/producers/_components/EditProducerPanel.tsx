'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EditProducerPanelProps {
  producerSlug: string
  producerName: string
}

type RequestType = 'edit_recipe' | 'add_example' | 'duplicate_with_changes' | 'deprecate' | 'other'

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  edit_recipe: 'Edit recipe',
  add_example: 'Add example output',
  duplicate_with_changes: 'Duplicate with changes',
  deprecate: 'Deprecate',
  other: 'Other',
}

export function EditProducerPanel({ producerSlug, producerName }: EditProducerPanelProps) {
  const [requestType, setRequestType] = useState<RequestType>('edit_recipe')
  const [requestText, setRequestText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!requestText.trim()) return
    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/producer-change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producer_slug: producerSlug,
          request_type: requestType,
          request_text: requestText,
          requester: 'matt',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      setResult('success')
      setRequestText('')
    } catch (err) {
      setResult('error')
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Request a change to {producerName}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Describe what you want changed. The orchestrator will draft a SKILL.md diff and a sample
          render for your review.
        </p>
        {/* TODO: orchestrator pickup is stubbed. The producer_change_requests row is written here;
            the orchestrator skill that polls 'pending' rows and dispatches a subagent to draft the
            change is a separate skill not yet built (Phase 10.5+ scope). */}
      </div>

      {result === 'success' && (
        <Alert>
          <AlertDescription>
            Change request submitted. The orchestrator will draft a proposal when it next runs.
          </AlertDescription>
        </Alert>
      )}

      {result === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>Failed to submit: {errorMsg}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="req-type">Request type</Label>
          <Select
            value={requestType}
            onValueChange={(v) => setRequestType(v as RequestType)}
          >
            <SelectTrigger id="req-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="req-text">Describe the change</Label>
          <Textarea
            id="req-text"
            placeholder="e.g. Add a step to verify Supabase row count before rendering. Current step 4 skips this check."
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            rows={5}
            required
          />
        </div>

        <Button
          type="submit"
          disabled={submitting || !requestText.trim()}
          className="w-full"
        >
          {submitting ? 'Submitting...' : 'Submit change request'}
        </Button>
      </form>
    </div>
  )
}
