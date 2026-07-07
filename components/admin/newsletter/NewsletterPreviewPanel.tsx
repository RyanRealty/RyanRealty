'use client'

/**
 * The visual-first newsletter review panel (Matt directive: he approves a
 * RENDERED newsletter, never raw HTML). Default tab is the rendered preview —
 * the exact wrapNewsletterHtml output the send pipeline delivers — inside a
 * sandboxed iframe at desktop (640px email) or mobile (375px) width, with a
 * per-broker switcher that visibly swaps the close card. The raw HTML source
 * sits behind a secondary tab.
 */

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminPreviewNewsletterAction, adminTestSendNewsletterAction } from '@/app/actions/newsletter'

const BROKERS: { value: string; label: string }[] = [
  { value: 'matt', label: 'Matt' },
  { value: 'rebecca', label: 'Rebecca' },
  { value: 'paul', label: 'Paul' },
]

type Props = {
  id: string
  /** Server-rendered initial preview (Matt's identity) so the page opens visual. */
  initialHtml: string | null
  initialBroker?: string
}

export default function NewsletterPreviewPanel({ id, initialHtml, initialBroker = 'matt' }: Props) {
  const [broker, setBroker] = useState(initialBroker)
  const [html, setHtml] = useState<string | null>(initialHtml)
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function loadPreview(slug: string) {
    setError(null)
    startTransition(async () => {
      const r = await adminPreviewNewsletterAction(id, slug)
      if (r.ok && r.html) {
        setHtml(r.html)
      } else {
        const map: Record<string, string> = {
          empty_body: 'This draft has no HTML body yet. Add one in the Edit tab and save.',
          no_brokers: 'The broker roster could not be read.',
          not_found: 'Newsletter not found.',
          unauthorized: 'You do not have access to preview.',
        }
        setError(map[r.error ?? ''] ?? r.error ?? 'Could not render the preview.')
      }
    })
  }

  function onBrokerChange(slug: string) {
    setBroker(slug)
    setTestMsg(null)
    loadPreview(slug)
  }

  function onTestSend() {
    setTestMsg(null)
    startTransition(async () => {
      const r = await adminTestSendNewsletterAction(id, broker)
      setTestMsg(
        r.ok
          ? { type: 'ok', text: 'Test sent to your inbox.' }
          : { type: 'err', text: r.error ?? 'Could not send the test.' },
      )
    })
  }

  const frameWidth = width === 'mobile' ? 375 : 680

  return (
    <Tabs defaultValue="preview" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TabsList>
          <TabsTrigger value="preview">Rendered preview</TabsTrigger>
          <TabsTrigger value="source">HTML source</TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="nl-preview-broker">Recipient&rsquo;s broker</Label>
            <Select value={broker} onValueChange={onBrokerChange}>
              <SelectTrigger id="nl-preview-broker" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BROKERS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            value={width}
            onValueChange={(v) => v && setWidth(v as 'desktop' | 'mobile')}
            aria-label="Preview width"
          >
            <ToggleGroupItem value="desktop">Desktop</ToggleGroupItem>
            <ToggleGroupItem value="mobile">Mobile</ToggleGroupItem>
          </ToggleGroup>
          <Button type="button" variant="outline" onClick={() => loadPreview(broker)} disabled={pending}>
            {pending ? 'Rendering…' : 'Refresh'}
          </Button>
          <Button type="button" variant="outline" onClick={onTestSend} disabled={pending}>
            Send test to me
          </Button>
        </div>
      </div>

      {testMsg ? (
        <p className={testMsg.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'} role="alert">
          {testMsg.text}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      <TabsContent value="preview">
        {html ? (
          <div className="flex justify-center rounded-xl border border-border bg-muted/40 p-4">
            <iframe
              title="Newsletter rendered preview"
              srcDoc={html}
              // Fully-restricted sandbox: the body is authored content. Static
              // HTML, CSS, and images still render under sandbox="".
              sandbox=""
              style={{ width: frameWidth, height: 900 }}
              className={cn('rounded-lg border border-border bg-background', width === 'mobile' && 'shadow-sm')}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
            No preview yet. Add an HTML body in the Edit section and save, then refresh.
          </div>
        )}
      </TabsContent>

      <TabsContent value="source">
        {html ? (
          <pre style={{ maxHeight: 720 }} className="overflow-auto rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-foreground">
            {html}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing rendered yet.</p>
        )}
      </TabsContent>
    </Tabs>
  )
}
