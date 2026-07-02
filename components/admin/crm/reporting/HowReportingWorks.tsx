'use client'

import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * §11.1 "ⓘ How Reporting works" pill — right-aligned in the reporting sub-nav.
 * Opens an honest text explainer (same pattern as the tasks module's
 * "How Tasks work" dialog — no fake video, Ryan Realty copy).
 */
export default function HowReportingWorks() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          How Reporting works
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How Reporting works</DialogTitle>
          <DialogDescription className="sr-only">
            An overview of how the CRM reporting module computes its numbers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-foreground">
          <p>
            Every report is computed live from the CRM database — the timeline of
            calls, emails, texts and notes, plus tasks, appointments, deals and
            lead records. Results may be cached for up to 10 minutes.
          </p>
          <p>
            Agent Activity counts personal 1:1 communication only. Messages sent
            by automations are excluded, so the numbers reflect real follow-up
            work by each broker.
          </p>
          <p>
            New Leads counts lead-created events inside the selected date range.
            Blue numbers drill through to the people behind the count.
          </p>
          <p className="text-muted-foreground">
            Brokers see their own numbers. The account owner sees everyone and
            can filter to any broker. Exports respect the same scope.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
