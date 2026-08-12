'use client'
// Client boundary: the Sheet holds the step the visitor is on and the answers it
// carries forward. Both are visitor-caused state, which a server component cannot hold.

/**
 * v3 PATTERN 5: SHEET.
 *
 * "The working surface for a step: form, filter set, comparison, plan detail.
 * Progressive: one question visible at a time on 390." (design_system/public/PUBLIC_UI.md
 * section 3, locked 2026-08-11.) This generalizes the valuation spine proven in the
 * moving prototype at app/dev/public-v3/sell/PublicV3Sell.client.tsx.
 *
 * The continuity requirement, which is the reason this pattern is a component and not a
 * form: what the visitor already answered stays on screen. The address typed in step one
 * is still visible in step two, and its arrival is the one motion this pattern spends
 * (PUBLIC_UI.md section 5: motion carries continuity, not decoration).
 *
 * ONE QUESTION, MECHANICALLY. A step carries `label`, the question, and at most ONE
 * control: `field`, singular. That is the pattern's defining rule expressed in the type
 * rather than left to caller discipline. An array of fields is how a Sheet becomes the
 * six-field long form on 390 that this pattern was written against. A multi-part capture
 * is multiple steps, and a filter set is a sequence of steps, one filter per step. That
 * is what progressive means here.
 *
 * ALL FOUR JOBS ARE EXPRESSIBLE. Section 3 names four: form, filter set, comparison,
 * plan detail. `field` carries the form and the filter. `blocks` carries the other two
 * as closed, typed structures: `points` for a plan's inclusions, `facts` for its
 * label-and-value detail, `compare` for a real comparison with column headers and row
 * headers. They are structures, not an open node slot, so a migration that needs a
 * comparison neither reaches outside the barrel nor flattens the comparison into
 * paragraphs.
 *
 * THE VALIDITY CONTRACT. `noValidate` stays on the form, and this primitive supplies
 * what it turns off, strictly stronger: format checking for email, tel, and number,
 * `pattern`, `minLength`, `maxLength`, `min`, `max`, membership checking for select and
 * choice, where a value that is not one of the options is refused, and a caller
 * `validate` hook that runs last. A step does not advance and `onAdvance` does not fire
 * while the visible field is invalid, which is what lets a caller hold a contract like
 * "address then email required, no orphan saves". Emptiness is the weakest of those
 * checks, not the only one.
 *
 * CONTROL BOUNDARY. The barrel law forbids importing @/components/ui, so the barrel
 * itself has to be the place a DOM control is constructed. This file constructs them in
 * exactly one place, the four functions under "Control boundary", and every one of them
 * requires the identity that carries the accessible name: a control requires the id of a
 * rendered name element, and the name element requires both that id and its text.
 * Scattering native form tags through the JSX of a public component satisfies neither
 * the barrel law nor the design-token rule against hand-rolled controls. A single named
 * boundary satisfies both, and it is the same boundary components/ui provides for the
 * product surfaces.
 *
 * THE TRAP IS THE ONE CONTROL NOBODY IS MEANT TO FILL, AND IT IS A PROP, NOT A STEP.
 * `trap` renders a honeypot inside the form: a text input a human never sees, never
 * tabs to, and never hears, that a scripted post fills because the DOM says it exists.
 * It is sheet-level rather than a field variant on purpose. A step's `field` is the ONE
 * question that step asks, and spending that slot on a trap would either delete a real
 * question or add a step asking nothing, both of which break the pattern's defining
 * rule. A honeypot is not a question; it is a property of the working surface, which is
 * where it now lives. It is still built through the same two constructors as every
 * other control, with a real name element, so the control boundary holds literally: the
 * wrapper carries aria-hidden and tabIndex -1, so the pair is out of the accessibility
 * tree and out of the tab order rather than nameless inside them. Its answer rides in
 * `onAdvance().answers` under its own name, never in the echo and never in a validity
 * check, because a filled trap is the caller's signal to fake a success, not a refusal
 * to show a visitor. A trap whose name collides with a field's is dropped, since a
 * collision would overwrite a real answer with a value no human typed.
 *
 * WHAT IS MECHANICAL HERE, AND WHAT IS NOT. An earlier revision claimed the type made a
 * nameless control impossible, through `NonNullable<ReactNode>` on the region name and
 * `label: string` on the field. It did not. `NonNullable<T>` is `T & {}`, and ReactNode
 * admits `boolean`, the empty string, `0`, and `[]`, so `heading={false}` compiled and
 * rendered a region pointed at an empty heading, and `label: ''` compiled and rendered a
 * control whose only name source was an empty name element. Every name on this primitive
 * is now `string`, which removes the ReactNode holes, and the remaining hole, the empty
 * string, is closed where it can actually hold: at render. A field with no label or no
 * name is dropped rather than rendered nameless, a step with no id or no question is
 * dropped, a duplicate step id or field name is dropped, and a blank region name means
 * the section renders as a plain container rather than as a landmark whose label a
 * screen reader cannot read. Each drop warns in development. Nothing here throws: a
 * caller bug is not worth a visitor's 500.
 *
 * NO SILENT RESTART. When `currentStepId`, or the sheet's own step id after a caller
 * reshapes `steps`, names no step, the sheet does not render step 1 and report step 1's
 * id to `onAdvance`. It renders the region, states that the step is not available, and
 * offers one action that moves to the first step and fires `onStepChange` so the caller
 * can resynchronize. A confident, plausible screen built on a caller bug is worse than
 * an honest one.
 *
 * Barrel law honored here:
 *  - Nothing imported from components/site/kb, components/site (flat),
 *    components/site/primitives, components/site/explore, or components/ui.
 *  - Color, size, radius, ring, and duration come from ./tokens.css. No raw color here.
 *  - It formats nothing. Values arrive as strings the caller already formatted, so the
 *    source trace stays with whoever pulled the number. The one date this pattern passes
 *    on, `updatedAt`, is checked before it reaches the source line: an unparseable value
 *    is dropped rather than rendered, because the canonical formatter answers an
 *    unparseable date with a dash, and that dash would land in public copy.
 */
import type { CSSProperties, ComponentPropsWithRef, ReactElement, ReactNode } from 'react'
import { createElement, useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Button, V3Eyebrow, V3Heading, V3SourceLine } from './atoms'
import './tokens.css'
import './V3Sheet.css'

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Supporting copy for a step. Deliberately NOT ReactNode: an open node slot is the
 * hole a nameless control walks through. A step says its piece in prose, anything a
 * visitor can type into arrives through `field`, and anything with structure arrives
 * through `blocks`.
 */
export type V3SheetProse = string | readonly string[]

export type V3SheetOption = {
  /** The value stored and echoed forward. */
  value: string
  /** The visible text. An option with none is dropped at render, never shown blank. */
  label: string
}

/**
 * Constraints shared by every field variant. They mirror the HTML validity attributes
 * on purpose: `noValidate` turns the browser's checking off so this primitive owns the
 * message and its placement, and these are what it checks in the browser's place.
 */
type V3SheetFieldBase = {
  /**
   * The key this answer is stored and echoed under, and the seed of the control id.
   * Unique across the whole sheet, not just the step. A duplicate is dropped.
   */
  name: string
  /**
   * The visible label, and therefore the accessible name. A field with a blank label
   * is dropped rather than rendered nameless.
   */
  label: string
  /** Tied to the control through aria-describedby. */
  hint?: string
  placeholder?: string
  /** The step will not advance while a required field is empty. */
  required?: boolean
  /** What reads when the visitor tries to advance past an empty required field. */
  requiredMessage?: string
  autoComplete?: string
  /** Minimum characters. Text, email, tel, and textarea. */
  minLength?: number
  /** Maximum characters. Enforced while typing as well as on advance. */
  maxLength?: number
  /**
   * The source of a regular expression the whole value must match, for example
   * `\\d{5}`. It is anchored here, so the caller writes the shape and not the anchors.
   * Pair it with `invalidMessage`: a shape only the caller knows needs a message only
   * the caller can write.
   */
  pattern?: string
  /** Lowest accepted value. `kind: 'number'` only. */
  min?: number
  /** Highest accepted value. `kind: 'number'` only. */
  max?: number
  /** What reads when the value is present but fails a format or a constraint. */
  invalidMessage?: string
  /**
   * The caller's own check, run last and only on a non-empty value. Return the message
   * to show, or null when the value is good. This is where a rule this primitive cannot
   * know lives: an address that must resolve, a code that must exist.
   */
  validate?: (value: string, answers: Readonly<Record<string, string>>) => string | null
  /**
   * Controlled value. Omit and the sheet holds the answer itself, which is the
   * common case: the sheet already has to keep it to echo it forward.
   */
  value?: string
  onChange?: (value: string) => void
}

/**
 * Every variant carries `label` and `name`. A field missing either cannot be rendered
 * with an accessible name, so it is dropped at render rather than shipped nameless.
 */
export type V3SheetField =
  | (V3SheetFieldBase & { kind?: 'text' | 'email' | 'tel' | 'number' })
  | (V3SheetFieldBase & { kind: 'textarea'; rows?: number })
  | (V3SheetFieldBase & { kind: 'select'; options: readonly V3SheetOption[] })
  | (V3SheetFieldBase & { kind: 'choice'; options: readonly V3SheetOption[] })

/** One label-and-value pair of a plan detail. `note` qualifies the value under it. */
export type V3SheetFact = {
  label: string
  value: string
  note?: string
}

/** One column of a comparison. `id` keys the column, `label` heads it. */
export type V3SheetColumn = {
  id: string
  label: string
}

/**
 * One row of a comparison: what is being compared, then one already-formatted string
 * per column, in column order. A row whose value count does not match the columns is
 * dropped, because a blank cell in a comparison reads as a claim the caller never made.
 */
export type V3SheetCompareRow = {
  label: string
  values: readonly string[]
}

/**
 * Structured step content. Closed on purpose: these three shapes are what section 3's
 * comparison and plan-detail jobs need, and a closed set is what keeps a migration from
 * reaching outside the barrel or reshaping its content to fit a form.
 */
export type V3SheetBlock =
  | {
      /** A plan's inclusions, or any short list that is not prose. */
      kind: 'points'
      label?: string
      items: readonly string[]
    }
  | {
      /** Plan detail: label-and-value pairs, values already formatted by the caller. */
      kind: 'facts'
      label?: string
      items: readonly V3SheetFact[]
    }
  | {
      /** A comparison. Two or three columns. More does not fit 390. */
      kind: 'compare'
      /** Names the comparison for a screen reader and heads it on screen. */
      label: string
      /** Heads the first column, the one carrying each row's subject. */
      rowsLabel: string
      columns: readonly V3SheetColumn[]
      rows: readonly V3SheetCompareRow[]
    }

export type V3SheetStep = {
  /** Stable id. Used for the controlled step, the DOM ids, and the advance event. */
  id: string
  /**
   * The one question this step asks. It is the step's accessible name and the line the
   * visitor reads. One question visible at a time on 390.
   */
  label: string
  /**
   * The single control that answers the question. Singular by design, see the header.
   * A terminal, confirming, comparing, or plan-detail step has none.
   */
  field?: V3SheetField
  /** Supporting prose, rendered before the blocks. One string is one paragraph. */
  children?: V3SheetProse
  /** Structured content: inclusions, plan detail, a comparison. */
  blocks?: readonly V3SheetBlock[]
  /**
   * The visible label of the control that leaves this step. Omit it and the step has
   * no forward action, which is how a terminal step is expressed. On the last step it
   * reads as the submit, and onAdvance fires with a null destination.
   */
  advanceLabel?: string
  /** Defaults to "Back". Only rendered when there is a step to go back to. */
  backLabel?: string
  /** The section 0 trace, when this step shows real data. */
  source?: string
}

/**
 * A honeypot. `name` is the key the value arrives under in `onAdvance().answers`, and
 * it is also what a bot reads when it decides to fill: use the name the trap is meant
 * to bait, `company` or `website`, not an invented one. `label` names the control in
 * the DOM so the control boundary is satisfied literally; nobody reads it, because the
 * wrapper is aria-hidden.
 */
export type V3SheetTrap = {
  name: string
  label: string
}

export type V3SheetAdvance = {
  /** The step the visitor is leaving. Always a step that was actually rendered. */
  fromStepId: string
  /** The step they land on, or null when the last step submits. */
  toStepId: string | null
  /** Every answer in the sheet, controlled and uncontrolled alike, keyed by field name. */
  answers: Readonly<Record<string, string>>
}

export type V3SheetProps = {
  /**
   * The name of the working surface. A string, not a node: a region's name is text.
   * Blank means the section renders as a plain container rather than as a landmark
   * carrying an empty name.
   */
  heading: string
  /** 2 by default. 1 only when the Sheet is the page's answer, which is rare. */
  headingLevel?: 1 | 2
  /** The context line above the heading. */
  eyebrow?: string
  /** The steps, in order. One is rendered at a time. */
  steps: readonly V3SheetStep[]
  /**
   * A honeypot rendered inside the form on every step. Omit it and the sheet renders
   * none. See the header: it is a property of the surface, not one of its questions.
   */
  trap?: V3SheetTrap
  /** Controlled mode. Pass the id of the step to show, and drive it from onAdvance. */
  currentStepId?: string
  /** Uncontrolled mode. The step to open on. Defaults to the first step. */
  defaultStepId?: string
  /** Answers the sheet starts with, keyed by field name. */
  defaultAnswers?: Readonly<Record<string, string>>
  /** Fires whenever the visible step changes, forward or back. */
  onStepChange?: (stepId: string) => void
  /**
   * Fires when the visitor completes a step, after every check on that step's field
   * has passed. On the last step toStepId is null, which is the submit: do the send
   * here. The primitive itself sends nothing and fetches nothing.
   */
  onAdvance?: (event: V3SheetAdvance) => void
  /** The accessible name of the carried-forward answers. Defaults to "Answers so far". */
  echoLabel?: string
  /** Set false when the sheet asks nothing worth carrying (a single-step filter set). */
  showEcho?: boolean
  /** Set false to drop the "Step 1 of 3" line on a single-step sheet. */
  showProgress?: boolean
  /** The trace for the sheet as a whole, when it presents real data. */
  source?: string
  /**
   * Passed to the canonical date formatter by V3SourceLine, after this primitive
   * confirms it parses. Never formatted here.
   */
  updatedAt?: string | number | Date | null
  /** What reads when the active step id names no step. */
  unknownStepLabel?: string
  /** The label of the one action offered on that screen. */
  unknownStepActionLabel?: string
  id?: string
  className?: string
}

/* -------------------------------------------------------------------------- */
/* Copy + constants                                                            */
/* -------------------------------------------------------------------------- */

const DEFAULT_ECHO_LABEL = 'Answers so far'
const DEFAULT_BACK_LABEL = 'Back'
const DEFAULT_REQUIRED_MESSAGE = 'Required to continue.'
const DEFAULT_UNKNOWN_STEP_LABEL = 'That step is not available.'
const DEFAULT_UNKNOWN_STEP_ACTION = 'Start at the first question'
const DEFAULT_TEXTAREA_ROWS = 4

/** Past this a comparison stops fitting 390, which is the width the pattern is for. */
const COMPARE_COLUMN_LIMIT = 3

const DEV = process.env.NODE_ENV !== 'production'

function warn(message: string) {
  if (DEV) console.warn(`V3Sheet: ${message}`)
}

/* -------------------------------------------------------------------------- */
/* Normalization                                                               */
/* -------------------------------------------------------------------------- */

/** Trimmed text, or nothing. An empty string is not a label and not a name. */
function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function paragraphs(body: V3SheetProse | undefined): string[] {
  if (body == null) return []
  const lines = typeof body === 'string' ? [body] : body
  return lines.map((line) => (line ?? '').trim()).filter((line) => line.length > 0)
}

/**
 * A date only if it is one. The canonical formatter answers null and NaN with a dash,
 * and that dash would land in public copy as "updated" followed by nothing readable. An
 * empty column, a malformed ISO string, or a zero-length value drops the clause instead:
 * the sheet does not know when the data was refreshed, so it does not say.
 */
function usableDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

type ReadyOption = {
  value: string
  label: string
}

type ReadyField = {
  name: string
  label: string
  kind: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'choice'
  hint?: string
  placeholder?: string
  required: boolean
  requiredMessage: string
  invalidMessage?: string
  autoComplete?: string
  minLength?: number
  maxLength?: number
  pattern?: string
  min?: number
  max?: number
  rows: number
  options: readonly ReadyOption[]
  validate?: V3SheetFieldBase['validate']
  controlledValue?: string
  onChange?: (value: string) => void
}

type ReadyCompareRow = {
  label: string
  values: string[]
}

type ReadyBlock =
  | {
      kind: 'points'
      label?: string
      items: string[]
    }
  | {
      kind: 'facts'
      label?: string
      items: V3SheetFact[]
    }
  | {
      kind: 'compare'
      label: string
      rowsLabel: string
      columns: V3SheetColumn[]
      rows: ReadyCompareRow[]
    }

type ReadyStep = {
  id: string
  label: string
  field?: ReadyField
  prose: string[]
  blocks: ReadyBlock[]
  advanceLabel?: string
  backLabel: string
  source?: string
}

/**
 * The refusal, and the step it belongs to. Carrying the step id is what lets the
 * message be derived during render instead of reset from an effect: an error raised on
 * one step is not a message about another, so it simply does not read on one.
 */
type StepError = {
  stepId: string
  message: string
}

type EchoRow = {
  name: string
  label: string
  value: string
}

function positive(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeOptions(
  raw: readonly V3SheetOption[] | undefined,
  fieldName: string,
): ReadyOption[] {
  const out: ReadyOption[] = []
  const seen = new Set<string>()

  for (const option of raw ?? []) {
    if (!option || typeof option !== 'object') continue
    const label = text(option.label)
    if (!label) {
      warn(`field "${fieldName}" dropped an option with no label.`)
      continue
    }
    const value = typeof option.value === 'string' ? option.value : ''
    if (seen.has(value)) {
      warn(`field "${fieldName}" dropped a duplicate option value "${value}".`)
      continue
    }
    seen.add(value)
    out.push({ value, label })
  }

  return out
}

/**
 * Refuses what cannot be rendered with an accessible name: no key to store the answer
 * under, no visible label, a duplicate key that would overwrite an earlier answer, or a
 * choice set left with nothing to choose from.
 */
function normalizeField(
  raw: V3SheetField | undefined,
  stepId: string,
  usedNames: Set<string>,
): ReadyField | undefined {
  if (!raw || typeof raw !== 'object') return undefined

  const name = text(raw.name)
  const label = text(raw.label)
  if (!name || !label) {
    warn(
      `step "${stepId}" dropped a field with no ${!name ? 'name' : 'label'}. A control with no accessible name is not rendered.`,
    )
    return undefined
  }
  if (usedNames.has(name)) {
    warn(`step "${stepId}" dropped field "${name}", a name already used in this sheet.`)
    return undefined
  }

  const kind = raw.kind ?? 'text'
  const declaredOptions = 'options' in raw ? raw.options : undefined
  const options =
    kind === 'select' || kind === 'choice' ? normalizeOptions(declaredOptions, name) : []
  if ((kind === 'select' || kind === 'choice') && options.length === 0) {
    warn(`step "${stepId}" dropped field "${name}", a ${kind} with no options to choose from.`)
    return undefined
  }
  if (raw.pattern && !text(raw.invalidMessage)) {
    warn(
      `field "${name}" sets a pattern with no invalidMessage. Only the caller knows what shape it wanted.`,
    )
  }

  usedNames.add(name)

  const rows =
    kind === 'textarea'
      ? (positive((raw as { rows?: number }).rows) ?? DEFAULT_TEXTAREA_ROWS)
      : DEFAULT_TEXTAREA_ROWS

  return {
    name,
    label,
    kind,
    hint: text(raw.hint),
    placeholder: text(raw.placeholder),
    required: raw.required === true,
    requiredMessage: text(raw.requiredMessage) ?? DEFAULT_REQUIRED_MESSAGE,
    invalidMessage: text(raw.invalidMessage),
    autoComplete: text(raw.autoComplete),
    minLength: positive(raw.minLength),
    maxLength: positive(raw.maxLength),
    pattern: text(raw.pattern),
    min: typeof raw.min === 'number' && Number.isFinite(raw.min) ? raw.min : undefined,
    max: typeof raw.max === 'number' && Number.isFinite(raw.max) ? raw.max : undefined,
    rows,
    options,
    validate: typeof raw.validate === 'function' ? raw.validate : undefined,
    controlledValue: typeof raw.value === 'string' ? raw.value : undefined,
    onChange: typeof raw.onChange === 'function' ? raw.onChange : undefined,
  }
}

function normalizeBlocks(
  raw: readonly V3SheetBlock[] | undefined,
  stepId: string,
): ReadyBlock[] {
  const out: ReadyBlock[] = []

  for (const block of raw ?? []) {
    if (!block || typeof block !== 'object') continue

    if (block.kind === 'points') {
      const items = (block.items ?? []).map((item) => (item ?? '').trim()).filter(Boolean)
      if (items.length === 0) continue
      out.push({ kind: 'points', label: text(block.label), items })
      continue
    }

    if (block.kind === 'facts') {
      const items = (block.items ?? []).flatMap((fact): V3SheetFact[] => {
        if (!fact || typeof fact !== 'object') return []
        const factLabel = text(fact.label)
        const factValue = text(fact.value)
        // A pair missing either half is half a fact, which reads as a claim the
        // caller did not make.
        if (!factLabel || !factValue) return []
        return [{ label: factLabel, value: factValue, note: text(fact.note) }]
      })
      if (items.length === 0) continue
      out.push({ kind: 'facts', label: text(block.label), items })
      continue
    }

    const label = text(block.label)
    const rowsLabel = text(block.rowsLabel)
    const columns = (block.columns ?? []).flatMap((column): V3SheetColumn[] => {
      if (!column || typeof column !== 'object') return []
      const columnLabel = text(column.label)
      const columnId = text(column.id)
      return columnLabel && columnId ? [{ id: columnId, label: columnLabel }] : []
    })

    if (!label || !rowsLabel || columns.length === 0) {
      warn(`step "${stepId}" dropped a comparison with no name, no row header, or no columns.`)
      continue
    }
    if (columns.length > COMPARE_COLUMN_LIMIT) {
      warn(
        `step "${stepId}" renders a comparison ${columns.length} columns wide. Past ${COMPARE_COLUMN_LIMIT} it scrolls sideways at 390.`,
      )
    }

    const rows = (block.rows ?? []).flatMap((row): ReadyCompareRow[] => {
      if (!row || typeof row !== 'object') return []
      const rowLabel = text(row.label)
      if (!rowLabel) return []
      const values = (row.values ?? []).map((value) => (value ?? '').trim())
      if (values.length !== columns.length) {
        warn(
          `step "${stepId}" dropped comparison row "${rowLabel}", which carries ${values.length} value(s) for ${columns.length} column(s).`,
        )
        return []
      }
      return [{ label: rowLabel, values }]
    })

    if (rows.length === 0) continue
    out.push({ kind: 'compare', label, rowsLabel, columns, rows })
  }

  return out
}

function normalizeSteps(steps: readonly V3SheetStep[]): ReadyStep[] {
  const out: ReadyStep[] = []
  const usedIds = new Set<string>()
  const usedNames = new Set<string>()

  for (const step of steps ?? []) {
    // A hole is dropped, never dereferenced. This repo's tsconfig has no
    // noUncheckedIndexedAccess, so `steps={[all[0]]}` type-checks against an empty
    // array and arrives here as undefined.
    if (!step || typeof step !== 'object') continue

    const id = text(step.id)
    const label = text(step.label)
    if (!id || !label) {
      warn(`dropped a step with no ${!id ? 'id' : 'question'}.`)
      continue
    }
    if (usedIds.has(id)) {
      warn(`dropped a second step carrying the id "${id}".`)
      continue
    }
    usedIds.add(id)

    out.push({
      id,
      label,
      field: normalizeField(step.field, id, usedNames),
      prose: paragraphs(step.children),
      blocks: normalizeBlocks(step.blocks, id),
      advanceLabel: text(step.advanceLabel),
      backLabel: text(step.backLabel) ?? DEFAULT_BACK_LABEL,
      source: text(step.source),
    })
  }

  return out
}

/**
 * Refuses a trap that cannot be rendered honestly: no key to carry the value, no name
 * element to build, or a key a real question already owns. The last one matters most —
 * a collision would let a bot's value overwrite a visitor's answer on the way to the
 * caller, which is worse than having no trap at all.
 */
function normalizeTrap(
  raw: V3SheetTrap | undefined,
  steps: readonly ReadyStep[],
): V3SheetTrap | undefined {
  if (!raw || typeof raw !== 'object') return undefined

  const name = text(raw.name)
  const label = text(raw.label)
  if (!name || !label) {
    warn(`dropped the trap: it carries no ${!name ? 'name' : 'label'}.`)
    return undefined
  }
  if (steps.some((s) => s.field?.name === name)) {
    warn(`dropped the trap "${name}": a question already answers under that name.`)
    return undefined
  }

  return { name, label }
}

/* -------------------------------------------------------------------------- */
/* Validity                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The WHATWG email production, plus a required dot in the domain. The browser's own
 * check accepts a dotless host, which is right for an intranet and wrong for a lead
 * capture where the address is the deliverable.
 */
const EMAIL_SHAPE =
  /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/

/** Digits and the punctuation a person actually types into a phone field. */
const TEL_SHAPE = /^[0-9+().\-\s]+$/
const TEL_MIN_DIGITS = 10
const TEL_MAX_DIGITS = 15

function formatMessage(field: ReadyField, fallback: string): string {
  return field.invalidMessage ?? fallback
}

/**
 * Every check `noValidate` turned off, in the order a person reads them: is it there,
 * is it the right kind of thing, is it inside the stated bounds, and last whatever rule
 * only the caller knows. Returns the message to show, or null.
 */
function checkField(
  field: ReadyField,
  raw: string,
  answers: Readonly<Record<string, string>>,
): string | null {
  const value = raw.trim()

  if (!value) return field.required ? field.requiredMessage : null

  if (field.kind === 'select' || field.kind === 'choice') {
    const known = field.options.some((option) => option.value === value)
    if (!known) return formatMessage(field, 'Choose one of the options.')
    return field.validate ? field.validate(raw, answers) : null
  }

  if (field.kind === 'email' && !EMAIL_SHAPE.test(value)) {
    return formatMessage(field, 'Enter an email address, like name@example.com.')
  }

  if (field.kind === 'tel') {
    const digits = value.replace(/\D/g, '')
    if (
      !TEL_SHAPE.test(value) ||
      digits.length < TEL_MIN_DIGITS ||
      digits.length > TEL_MAX_DIGITS
    ) {
      return formatMessage(field, 'Enter a phone number with its area code.')
    }
  }

  if (field.kind === 'number') {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return formatMessage(field, 'Enter a number.')
    if (
      field.min !== undefined &&
      field.max !== undefined &&
      (parsed < field.min || parsed > field.max)
    ) {
      return formatMessage(field, `Enter a number from ${field.min} to ${field.max}.`)
    }
    if (field.min !== undefined && parsed < field.min) {
      return formatMessage(field, `Enter ${field.min} or more.`)
    }
    if (field.max !== undefined && parsed > field.max) {
      return formatMessage(field, `Enter ${field.max} or less.`)
    }
  }

  if (field.minLength !== undefined && value.length < field.minLength) {
    return formatMessage(field, `Use at least ${field.minLength} characters.`)
  }
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    return formatMessage(field, `Use ${field.maxLength} characters or fewer.`)
  }

  if (field.pattern) {
    let shape: RegExp | null = null
    try {
      shape = new RegExp(`^(?:${field.pattern})$`)
    } catch {
      warn(`field "${field.name}" carries a pattern that is not a regular expression.`)
    }
    if (shape && !shape.test(value)) {
      return formatMessage(field, 'That entry does not match the format this field expects.')
    }
  }

  return field.validate ? field.validate(raw, answers) : null
}

/* -------------------------------------------------------------------------- */
/* Control boundary                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The identity a control cannot be constructed without: the id a name element points
 * at, and the key the answer is stored under. Every constructor below takes it, and
 * nothing else in this file constructs a form element, so a control with no name has no
 * path to the DOM through this primitive.
 */
type ControlIdentity = {
  id: string
  name: string
}

type NameElementProps = ComponentPropsWithRef<'label'> & {
  htmlFor: string
  children: NonNullable<ReactNode>
}

/** The visible name of a control, tied to it by id. Takes its text, non-nullable. */
function nameElement(props: NameElementProps): ReactElement {
  return createElement('label', props)
}

function lineControl(props: ComponentPropsWithRef<'input'> & ControlIdentity): ReactElement {
  return createElement('input', props)
}

function areaControl(props: ComponentPropsWithRef<'textarea'> & ControlIdentity): ReactElement {
  return createElement('textarea', props)
}

function listControl(
  props: ComponentPropsWithRef<'select'> & ControlIdentity,
  options: ReactNode,
): ReactElement {
  return createElement('select', props, options)
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                      */
/* -------------------------------------------------------------------------- */

type BlockViewProps = {
  block: ReadyBlock
  idSeed: string
}

function BlockView({ block, idSeed }: BlockViewProps) {
  const labelId = `${idSeed}-label`

  if (block.kind === 'points') {
    return (
      <div className="v3-sheet-block">
        {block.label ? (
          <p className="v3-sheet-block-label" id={labelId}>
            {block.label}
          </p>
        ) : null}
        <ul className="v3-sheet-points" aria-labelledby={block.label ? labelId : undefined}>
          {block.items.map((item, index) => (
            <li className="v3-sheet-point" key={index}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (block.kind === 'facts') {
    return (
      <div className="v3-sheet-block">
        {block.label ? (
          <p className="v3-sheet-block-label" id={labelId}>
            {block.label}
          </p>
        ) : null}
        <dl className="v3-sheet-facts" aria-labelledby={block.label ? labelId : undefined}>
          {block.items.map((fact, index) => (
            <div className="v3-sheet-fact" key={index}>
              <dt className="v3-sheet-fact-label">{fact.label}</dt>
              <dd className="v3-sheet-fact-value">
                <span className="v3-sheet-fact-figure">{fact.value}</span>
                {fact.note ? <span className="v3-sheet-fact-note">{fact.note}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  // A comparison with real column headers and real row headers, so a screen reader
  // reads "Included, Full service, yes" rather than three loose words.
  return (
    <div className="v3-sheet-block">
      <p className="v3-sheet-block-label" id={labelId}>
        {block.label}
      </p>
      <div
        className="v3-sheet-compare"
        role="table"
        aria-labelledby={labelId}
        style={{ '--v3-sheet-cols': String(block.columns.length) } as CSSProperties}
      >
        <div className="v3-sheet-compare-group" role="rowgroup">
          <div className="v3-sheet-compare-row v3-sheet-compare-row--head" role="row">
            <span className="v3-sheet-compare-corner" role="columnheader">
              {block.rowsLabel}
            </span>
            {block.columns.map((column) => (
              <span className="v3-sheet-compare-head" role="columnheader" key={column.id}>
                {column.label}
              </span>
            ))}
          </div>
        </div>
        <div className="v3-sheet-compare-group" role="rowgroup">
          {block.rows.map((row, rowIndex) => (
            <div className="v3-sheet-compare-row" role="row" key={rowIndex}>
              <span className="v3-sheet-compare-rowhead" role="rowheader">
                {row.label}
              </span>
              {row.values.map((value, cellIndex) => (
                <span className="v3-sheet-compare-cell" role="cell" key={cellIndex}>
                  {value}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* V3Sheet                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One question at a time, with everything already answered still on screen.
 *
 * Used for the valuation spine on Sell, a filter step on Homes, a plan detail, and any
 * other surface where the visitor is working rather than reading. One primary action
 * per viewport: the advance control is the only primary a Sheet renders.
 */
export function V3Sheet({
  heading,
  headingLevel = 2,
  eyebrow,
  steps,
  trap,
  currentStepId,
  defaultStepId,
  defaultAnswers,
  onStepChange,
  onAdvance,
  echoLabel = DEFAULT_ECHO_LABEL,
  showEcho = true,
  showProgress = true,
  source,
  updatedAt,
  unknownStepLabel,
  unknownStepActionLabel,
  id,
  className,
}: V3SheetProps) {
  const uid = useId()
  const title = text(heading)
  const headingId = title ? `${uid}-heading` : undefined
  const contextLine = text(eyebrow)

  const ready = useMemo(() => normalizeSteps(steps), [steps])
  const bait = useMemo(() => normalizeTrap(trap, ready), [trap, ready])

  const isControlled = currentStepId !== undefined
  const [internalStepId, setInternalStepId] = useState<string>(() => {
    const wanted = text(defaultStepId)
    if (wanted && ready.some((s) => s.id === wanted)) return wanted
    if (wanted) {
      warn(`defaultStepId "${wanted}" names no step, so the sheet opened on the first one.`)
    }
    return ready[0]?.id ?? ''
  })

  const activeId = isControlled ? currentStepId : internalStepId
  const activeIndex = ready.findIndex((s) => s.id === activeId)
  const step: ReadyStep | undefined = activeIndex < 0 ? undefined : ready[activeIndex]

  const [answers, setAnswers] = useState<Record<string, string>>(() => ({
    ...(defaultAnswers ?? {}),
  }))
  const [errorState, setErrorState] = useState<StepError | null>(null)

  // Focus moves to the new question only when the visitor caused the move, never on
  // first paint. Without this a screen reader is left on a control that no longer
  // exists, since only one step is in the DOM at a time. The effect does nothing else:
  // the refusal message is derived from state during render, not reset from here.
  const movedRef = useRef(false)
  const questionRef = useRef<HTMLParagraphElement | null>(null)

  useEffect(() => {
    if (!movedRef.current) return
    movedRef.current = false
    questionRef.current?.focus()
  }, [activeId])

  const freshness = usableDate(updatedAt)
  const trace = text(source)

  const goTo = (nextId: string) => {
    movedRef.current = true
    setErrorState(null)
    if (!isControlled) setInternalStepId(nextId)
    onStepChange?.(nextId)
  }

  const readValue = (target: ReadyField): string =>
    target.controlledValue !== undefined ? target.controlledValue : (answers[target.name] ?? '')

  const collectAnswers = (): Record<string, string> => {
    const out: Record<string, string> = { ...answers }
    for (const s of ready) {
      if (s.field) out[s.field.name] = readValue(s.field)
    }
    return out
  }

  /* ---------------------------------------------------------------------- */
  /* The active step id names no step                                        */
  /* ---------------------------------------------------------------------- */

  if (!step) {
    const first = ready[0]

    if (first && activeId) {
      // A caller bug, not a data condition: a typo, stale parent state, or a step
      // removed by a condition while its id was still the active one. The sheet does
      // not quietly render step 1 and report step 1's id to onAdvance.
      warn(
        `${isControlled ? 'currentStepId' : 'the active step'} "${activeId}" names no step. Known ids: ${ready
          .map((s) => s.id)
          .join(', ')}.`,
      )

      return (
        <section
          id={id}
          className={cn(V3_ROOT_CLASS, 'v3-sheet', className)}
          aria-labelledby={headingId}
        >
          <div className="v3-sheet-head">
            {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
            {title ? (
              <V3Heading level={headingLevel} id={headingId}>
                {title}
              </V3Heading>
            ) : null}
          </div>
          <p className="v3-sheet-question">
            {text(unknownStepLabel) ?? DEFAULT_UNKNOWN_STEP_LABEL}
          </p>
          <div className="v3-sheet-actions">
            <V3Button type="button" variant="primary" onClick={() => goTo(first.id)}>
              {text(unknownStepActionLabel) ?? DEFAULT_UNKNOWN_STEP_ACTION}
            </V3Button>
          </div>
        </section>
      )
    }

    // Nothing to work through at all. The heading still names the region rather than
    // the section disappearing without explanation.
    return (
      <section
        id={id}
        className={cn(V3_ROOT_CLASS, 'v3-sheet', className)}
        aria-labelledby={headingId}
      >
        {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
        {title ? (
          <V3Heading level={headingLevel} id={headingId}>
            {title}
          </V3Heading>
        ) : null}
      </section>
    )
  }

  /* ---------------------------------------------------------------------- */
  /* The working step                                                        */
  /* ---------------------------------------------------------------------- */

  const field = step.field

  // A refusal reads only on the step that raised it. Derived here rather than cleared
  // from an effect, so a step never paints once carrying the previous step's message.
  const error = errorState && errorState.stepId === step.id ? errorState.message : null

  const questionId = `${uid}-${step.id}-question`
  const fieldId = field ? `${uid}-${step.id}-${field.name}` : ''
  const labelId = `${fieldId}-label`
  const hintId = field?.hint ? `${fieldId}-hint` : undefined
  const errorId = field && error ? `${fieldId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const invalid = error !== null

  const writeValue = (target: ReadyField, next: string) => {
    target.onChange?.(next)
    if (target.controlledValue === undefined) {
      setAnswers((prev) => ({ ...prev, [target.name]: next }))
    }
    // Clear a standing error the moment the value satisfies every check. Errors are
    // raised on advance, never while the visitor is typing the first character.
    if (error !== null) {
      const still = checkField(target, next, { ...collectAnswers(), [target.name]: next })
      if (!still) setErrorState(null)
    }
  }

  const displayValue = (target: ReadyField, raw: string): string => {
    if (target.kind === 'select' || target.kind === 'choice') {
      return target.options.find((o) => o.value === raw)?.label ?? raw
    }
    return raw
  }

  // Focus moves to the control that refused the advance. The id is already known and
  // already unique, so an event handler can find the element without this render
  // holding a ref to it.
  const focusControl = () => {
    if (!field) return
    const targetId =
      field.kind === 'choice' ? `${fieldId}-${field.options[0]?.value ?? ''}` : fieldId
    document.getElementById(targetId)?.focus()
  }

  const handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault()

    // A step with no forward action does not advance. Without this an implicit
    // submission, Enter pressed inside the only control, would leave a terminal step.
    if (!step.advanceLabel) return

    if (field) {
      const message = checkField(field, readValue(field), collectAnswers())
      if (message) {
        setErrorState({ stepId: step.id, message })
        focusControl()
        return
      }
    }

    setErrorState(null)
    const next = ready[activeIndex + 1]
    onAdvance?.({
      fromStepId: step.id,
      toStepId: next ? next.id : null,
      answers: collectAnswers(),
    })
    if (next) goTo(next.id)
  }

  const goBack = () => {
    const prev = ready[activeIndex - 1]
    if (prev) goTo(prev.id)
  }

  // The continuity carry: everything answered before this step, still on screen.
  const echoed: EchoRow[] = []
  if (showEcho) {
    for (let i = 0; i < activeIndex; i += 1) {
      const earlier = ready[i]?.field
      if (!earlier) continue
      const raw = readValue(earlier)
      if (!raw.trim()) continue
      echoed.push({
        name: earlier.name,
        label: earlier.label,
        value: displayValue(earlier, raw),
      })
    }
  }

  const current = field ? readValue(field) : ''

  // The length bounds are a text idea, so they ride with the typed controls rather
  // than with every control.
  const typedBounds = {
    minLength: field?.minLength,
    maxLength: field?.maxLength,
  }

  const sharedControl = field
    ? {
        id: fieldId,
        name: field.name,
        required: field.required,
        'aria-invalid': invalid || undefined,
        'aria-describedby': describedBy,
      }
    : null

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-sheet', className)}
      aria-labelledby={headingId}
    >
      <div className="v3-sheet-head">
        {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
        {title ? (
          <V3Heading level={headingLevel} id={headingId}>
            {title}
          </V3Heading>
        ) : null}
        {showProgress && ready.length > 1 ? (
          <p className="v3-sheet-progress">
            Step {activeIndex + 1} of {ready.length}
          </p>
        ) : null}
      </div>

      {echoed.length > 0 ? (
        <dl className="v3-sheet-echo" aria-label={echoLabel} key={`echo-${step.id}`}>
          {echoed.map((e) => (
            <div className="v3-sheet-echo-row" key={e.name}>
              <dt className="v3-sheet-echo-label">{e.label}</dt>
              <dd className="v3-sheet-echo-value">{e.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <form
        className="v3-sheet-step"
        key={step.id}
        onSubmit={handleSubmit}
        noValidate
        role="group"
        aria-labelledby={questionId}
      >
        <p className="v3-sheet-question" id={questionId} ref={questionRef} tabIndex={-1}>
          {step.label}
        </p>

        {/* The honeypot. aria-hidden and tabIndex -1 keep the pair out of the
            accessibility tree and out of the tab order; the CSS keeps it off the
            screen without display:none, which a scripted filler would skip. It
            renders on every step, so a bot that only posts the last form still
            trips it, and its value lives in `answers` like any other. */}
        {bait ? (
          <div className="v3-sheet-trap" aria-hidden="true">
            {nameElement({
              id: `${uid}-trap-label`,
              htmlFor: `${uid}-trap`,
              children: bait.label,
            })}
            {lineControl({
              id: `${uid}-trap`,
              name: bait.name,
              type: 'text',
              tabIndex: -1,
              autoComplete: 'off',
              value: answers[bait.name] ?? '',
              onChange: (e) =>
                setAnswers((prev) => ({ ...prev, [bait.name]: e.target.value })),
            })}
          </div>
        ) : null}

        {field && sharedControl ? (
          field.kind === 'choice' ? (
            <fieldset
              className="v3-sheet-field v3-sheet-fieldset"
              role="radiogroup"
              aria-required={field.required || undefined}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            >
              <legend className="v3-sheet-label">{field.label}</legend>
              <div className="v3-sheet-choices">
                {field.options.map((option) =>
                  nameElement({
                    className: 'v3-sheet-choice',
                    key: `${fieldId}-${option.value}`,
                    htmlFor: `${fieldId}-${option.value}`,
                    children: (
                      <>
                        {lineControl({
                          className: 'v3-sheet-radio',
                          id: `${fieldId}-${option.value}`,
                          name: fieldId,
                          type: 'radio',
                          value: option.value,
                          checked: current === option.value,
                          onChange: () => writeValue(field, option.value),
                        })}
                        <span className="v3-sheet-choice-label">{option.label}</span>
                      </>
                    ),
                  }),
                )}
              </div>
              {field.hint ? (
                <p className="v3-sheet-hint" id={hintId}>
                  {field.hint}
                </p>
              ) : null}
              {error ? (
                <p className="v3-sheet-error" id={errorId} role="alert">
                  {error}
                </p>
              ) : null}
            </fieldset>
          ) : (
            <div className="v3-sheet-field">
              {nameElement({
                className: 'v3-sheet-label',
                id: labelId,
                htmlFor: fieldId,
                children: field.label,
              })}

              {field.kind === 'textarea' ? (
                areaControl({
                  ...sharedControl,
                  className: 'v3-sheet-control v3-sheet-textarea',
                  rows: field.rows,
                  ...typedBounds,
                  value: current,
                  placeholder: field.placeholder,
                  autoComplete: field.autoComplete,
                  onChange: (e) => writeValue(field, e.target.value),
                })
              ) : field.kind === 'select' ? (
                <span className="v3-sheet-select-wrap">
                  {listControl(
                    {
                      ...sharedControl,
                      className: 'v3-sheet-control v3-sheet-select',
                      value: current,
                      onChange: (e) => writeValue(field, e.target.value),
                    },
                    <>
                      {field.placeholder ? (
                        <option value="">{field.placeholder}</option>
                      ) : null}
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </>,
                  )}
                </span>
              ) : (
                lineControl({
                  ...sharedControl,
                  className: 'v3-sheet-control',
                  type:
                    field.kind === 'email' ? 'email' : field.kind === 'tel' ? 'tel' : 'text',
                  inputMode:
                    field.kind === 'number'
                      ? 'numeric'
                      : field.kind === 'tel'
                        ? 'tel'
                        : field.kind === 'email'
                          ? 'email'
                          : undefined,
                  ...typedBounds,
                  value: current,
                  placeholder: field.placeholder,
                  autoComplete: field.autoComplete,
                  onChange: (e) => writeValue(field, e.target.value),
                })
              )}

              {field.hint ? (
                <p className="v3-sheet-hint" id={hintId}>
                  {field.hint}
                </p>
              ) : null}
              {error ? (
                <p className="v3-sheet-error" id={errorId} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          )
        ) : null}

        {step.prose.map((line, lineIndex) => (
          <p className="v3-sheet-prose" key={lineIndex}>
            {line}
          </p>
        ))}

        {step.blocks.map((block, blockIndex) => (
          <BlockView
            block={block}
            idSeed={`${uid}-${step.id}-block-${blockIndex}`}
            key={blockIndex}
          />
        ))}

        {step.advanceLabel || activeIndex > 0 ? (
          <div className="v3-sheet-actions">
            {step.advanceLabel ? (
              <V3Button type="submit" variant="primary">
                {step.advanceLabel}
              </V3Button>
            ) : null}
            {activeIndex > 0 ? (
              <V3Button type="button" variant="text" onClick={goBack}>
                {step.backLabel}
              </V3Button>
            ) : null}
          </div>
        ) : null}

        {step.source ? <V3SourceLine source={step.source} /> : null}
      </form>

      {trace ? (
        <V3SourceLine className="v3-sheet-foot" source={trace} updatedAt={freshness} />
      ) : null}
    </section>
  )
}
