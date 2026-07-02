/**
 * editor-shared — types + labels + tile inventory shared by the §12.4 visual
 * automation editor (EditorPalette / EditorCanvas / StepConfigPanel /
 * AutomationEditor). Client-safe, no I/O.
 *
 * Spec: docs/fub-crm-spec/12-action-plans-and-automations.md §12.4 (left
 * palette two-tab structure, Controls + Actions sections, canvas cards).
 * The action inventory maps to OUR engine's executable channels
 * (lib/crm/sequence-step-schema.ts STEP_CHANNELS) — every palette tile is a
 * step the engine actually runs. No decorative, non-executable steps.
 */

import type { StepChannel, SequenceTriggerType } from '@/lib/crm/sequence-step-schema'

/** What is selected in the editor — drives the right config panel (§12.4.4). */
export type EditorSelection =
  | { kind: 'settings' }
  | { kind: 'trigger' }
  | { kind: 'step'; idx: number }

/** Drag payload carried from the palette to a canvas drop zone. */
export type PaletteDragPayload =
  | { kind: 'channel'; channel: StepChannel }
  | { kind: 'condition' }
  | { kind: 'time_delay' }

/** The custom dataTransfer MIME type for palette drags. */
export const PALETTE_DRAG_TYPE = 'text/x-rr-automation-step'

export function encodeDragPayload(p: PaletteDragPayload): string {
  return JSON.stringify(p)
}

export function decodeDragPayload(raw: string): PaletteDragPayload | null {
  try {
    const v = JSON.parse(raw) as PaletteDragPayload
    if (v && (v.kind === 'condition' || v.kind === 'time_delay' || (v.kind === 'channel' && typeof v.channel === 'string'))) return v
  } catch {
    /* not ours */
  }
  return null
}

/** Palette tile labels for every executable action channel (§12.4.2 Actions). */
export const ACTION_TILES: Array<{ channel: StepChannel; label: string; description: string }> = [
  { channel: 'email', label: 'Send Email', description: 'Send a templated or inline email' },
  { channel: 'sms', label: 'Send Text', description: 'Send a text from the assigned broker' },
  { channel: 'task', label: 'Create Task', description: 'Create a follow-up task' },
  { channel: 'tag', label: 'Add / Remove Tags', description: 'Add or remove contact tags' },
  { channel: 'change_stage', label: 'Change Stage', description: 'Move the contact to a stage' },
  { channel: 'add_note', label: 'Add Note', description: 'Add a note to the timeline' },
  { channel: 'reassign', label: 'Reassign Agent', description: 'Assign a different broker' },
  { channel: 'run_automation', label: 'Run Automation', description: 'Start another automation' },
  { channel: 'stop_other_plans', label: 'Pause Other Automations', description: 'Pause every other running automation' },
]

/** Controls section tiles (§12.4.2 Controls). */
export const CONTROL_TILES: Array<{ kind: 'condition' | 'time_delay'; label: string; description: string }> = [
  { kind: 'condition', label: 'Conditions', description: 'Either condition is true or false' },
  { kind: 'time_delay', label: 'Time Delay', description: 'Wait before starting the next step' },
]

/** Trigger tiles (§12.4.2 Triggers tab / §12.7 trigger inventory). */
export const TRIGGER_TYPE_LABELS: Record<SequenceTriggerType, string> = {
  tag_added: 'Tag Added',
  stage_changed: 'Stage Changed',
  source_is: 'Source Is',
  deal_stage_changed: 'Deal Stage Changed',
  inquiry: 'New Inquiry',
  property_saved: 'Property Saved',
  calendar_date: 'Calendar Date',
  appointment: 'Appointment',
}

/** Canvas card label per channel (matches the palette). */
export const CHANNEL_CARD_LABELS: Record<StepChannel, string> = {
  email: 'Send Email',
  sms: 'Send Text',
  task: 'Create Task',
  tag: 'Add / Remove Tags',
  change_stage: 'Change Stage',
  add_note: 'Add Note',
  reassign: 'Reassign Agent',
  run_automation: 'Run Automation',
  stop_other_plans: 'Pause Other Automations',
}
