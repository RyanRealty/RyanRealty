/**
 * Owner-reported work on the subject house.
 *
 * When Matt (or the owner) says what has been done — paint, counters, a bath
 * remodel — those notes belong on the seller document. They are not MLS
 * remarks and they are not an inspected condition rating. They also feed the
 * Zestimate buster: Zillow is reading the last public listing, not this list.
 */

import { escapeHtml } from '@/lib/cma/render-blocks'

const esc = escapeHtml
const MAX_NOTES = 12

export function parseOwnerNotes(text?: string | null, items?: readonly string[] | null): string[] {
  const fromItems = (items ?? []).map((s) => s.trim()).filter(Boolean)
  if (fromItems.length > 0) return fromItems.slice(0, MAX_NOTES)
  const raw = (text ?? '').trim()
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•·]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, MAX_NOTES)
}

function body(notes: readonly string[]): { list: string; empty: boolean } {
  const kept = notes.map((n) => n.trim()).filter(Boolean)
  return {
    empty: kept.length === 0,
    list: kept.map((n) => `<li>${esc(n)}</li>`).join(''),
  }
}

export function renderOwnerNotesPrintHtml(notes: readonly string[]): string {
  const { empty, list } = body(notes)
  if (empty) return ''
  return `
  <h2 class="section">What you have done to this house</h2>
  <p>These are the updates you reported. They are not in the public listing record Zillow is reading.</p>
  <ul class="note-list">${list}</ul>
  <p class="small">We have not inspected this work. A walkthrough confirms it.</p>`
}

export function renderOwnerNotesSceneHtml(notes: readonly string[]): string {
  const { empty, list } = body(notes)
  if (empty) return ''
  return `
  <section class="sc sc-cream" id="owner-notes">
    <div class="in">
      <div class="kick r">Notes from you</div>
      <h2 class="h r">What you have done to this house</h2>
      <p class="lede r">These are the updates you reported. They are not in the public listing record Zillow is reading.</p>
      <ul class="note-list r">${list}</ul>
      <p class="src r">We have not inspected this work. A walkthrough confirms it.</p>
    </div>
  </section>`
}
