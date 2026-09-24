// @no-parity — internal admin tool (file workspace: Documents tab)
//
// The checklist on the left, the document it points at on the right (Matt
// 2026-09-24). Selecting a document is a link (?doc=), so the view survives a
// reload and can be sent to someone. The reader's verdict and the printed-form
// check sit above the PDF, and the principal broker signs off right there.
import Link from 'next/link'
import { StateWord } from '@/components/admin/v2'
import type { TcCycle, TcDeal, TcDocument } from '@/app/actions/tc'
import type { AnticipatedDocsResult } from '@/app/actions/tc-required-docs'
import { readerView } from '@/lib/tc/doc-read/view'
import { CHECKLIST_GROUPS, checklistGroupForRule } from '@/lib/tc/required-documents'
import { CHECKLIST_WORD, documentStateWord, matchesChecklistFilter, type ChecklistFilter } from '@/lib/tc/file-workspace'
import { ChecklistStatusControl } from '../ChecklistControls'
import { DocumentUpload } from '../DocumentUpload'
import { ArchiveToggle, DownloadButton, ShareToggle } from '../DocumentRowActions'
import { SignOffControls } from '../../../sign-off/SignOffControls'
import { AnticipatedDocs } from './AnticipatedDocs'
import { DocViewer } from './DocViewer'

const kb = (n: number | null | undefined) =>
  n == null ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
const d10 = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '')

const FILTERS: Array<{ key: ChecklistFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'To review' },
  { key: 'missing', label: 'Missing' },
  { key: 'done', label: 'Done' },
]

const docState = (doc: TcDocument) => documentStateWord(doc.classification)

export function DocumentsTab({
  deal,
  cycle,
  filter,
  selectedDocId,
  showArchived,
  superuser,
  anticipated,
}: {
  deal: TcDeal
  cycle: TcCycle
  filter: ChecklistFilter
  selectedDocId: string | null
  showArchived: boolean
  superuser: boolean
  anticipated: AnticipatedDocsResult | null
}) {
  const base = `/admin/deals/${encodeURIComponent(deal.property_key)}`
  const href = (p: { filter?: ChecklistFilter; doc?: string | null; archived?: boolean }) => {
    const q = new URLSearchParams({ tab: 'documents', cycle: cycle.id })
    const f = p.filter ?? filter
    if (f !== 'all') q.set('filter', f)
    const doc = p.doc === undefined ? selectedDocId : p.doc
    if (doc) q.set('doc', doc)
    if (p.archived ?? showArchived) q.set('archived', '1')
    return `${base}?${q.toString()}`
  }

  const docById = new Map(cycle.documents.map((d) => [d.id, d]))
  const counts: Record<ChecklistFilter, number> = {
    all: cycle.checklist.length,
    review: cycle.checklist.filter((i) => i.status === 'in_review').length,
    missing: cycle.checklist.filter((i) => i.status === 'required').length,
    done: cycle.checklist.filter((i) => i.status === 'completed' || i.status === 'na').length,
  }
  const shown = cycle.checklist.filter((i) => matchesChecklistFilter(i.status, filter))
  const assigned = new Set(cycle.checklist.flatMap((i) => i.documentIds))
  const working = cycle.documents.filter((d) => !d.archived && !assigned.has(d.id))
  const archived = cycle.documents.filter((d) => d.archived)

  // The document on screen: the one asked for, else the first one the filter
  // shows, else the first live document on the cycle.
  const firstInFilter = shown.flatMap((i) => i.documentIds).find((id) => docById.has(id) && (showArchived || !docById.get(id)!.archived))
  const selected =
    (selectedDocId && docById.get(selectedDocId)) ||
    (firstInFilter ? docById.get(firstInFilter) : undefined) ||
    cycle.documents.find((d) => !d.archived) ||
    null
  const itemsForSelected = selected ? cycle.checklist.filter((i) => i.documentIds.includes(selected.id)) : []
  const read = selected ? readerView(selected.classification) : null
  const selState = selected ? docState(selected) : null

  const docLink = (id: string, label: string) => {
    const d = docById.get(id)
    if (!d || (d.archived && !showArchived)) return null
    return (
      <Link key={id} href={href({ doc: id })} className="av2-cl__doc" aria-current={selected?.id === id ? 'true' : undefined} scroll={false}>
        {label}
        {d.archived ? ' (archived)' : ''}
      </Link>
    )
  }

  return (
    <div className="av2-split">
      <div className="av2-split__rail">
        <nav className="av2-subnav" aria-label="Checklist filter" style={{ marginBottom: 'var(--a-s3)' }}>
          <div className="av2-subnav__scroll">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={href({ filter: f.key, doc: null })}
                className="av2-subnav__link"
                aria-current={filter === f.key ? 'page' : undefined}
                scroll={false}
              >
                {f.label}
                {counts[f.key] ? (
                  <span className={`av2-subnav__badge${f.key === 'review' && counts.review ? ' av2-subnav__badge--hot' : ''}`}>{counts[f.key]}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </nav>
        <div style={{ margin: '0 0 var(--a-s3)' }}>
          <DocumentUpload cycleId={cycle.id} checklistItems={cycle.checklist.map((it) => ({ id: it.id, name: it.name }))} />
        </div>

        {shown.length === 0 ? (
          <p className="av2-cl__none" style={{ margin: 'var(--a-s3) 0' }}>
            {filter === 'review'
              ? 'Nothing on this cycle is waiting for review.'
              : filter === 'missing'
                ? 'No required document is missing on this cycle.'
                : filter === 'done'
                  ? 'Nothing is done yet on this cycle.'
                  : 'This cycle has no checklist yet.'}
          </p>
        ) : (
          CHECKLIST_GROUPS.map((g) => {
            const items = shown.filter((it) => (it.group_name || checklistGroupForRule(it.type_name ?? '', it.name)) === g)
            if (!items.length) return null
            return (
              <div key={g}>
                <p className="av2-cl__group">{g}</p>
                <ul className="av2-cl">
                  {items.map((item) => {
                    const w = CHECKLIST_WORD[item.status] ?? CHECKLIST_WORD.optional
                    const current = !!selected && item.documentIds.includes(selected.id)
                    return (
                      <li key={item.id} className={`av2-cl__item${current ? ' av2-cl__item--current' : ''}`}>
                        <span className="av2-cl__body">
                          <span className="av2-cl__name">{item.name}</span>
                          <span className="av2-cl__docs">
                            {item.documentIds.length ? (
                              item.documentIds.map((id) => docLink(id, docById.get(id)?.name ?? 'Document'))
                            ) : (
                              <span className="av2-cl__none">No document yet</span>
                            )}
                          </span>
                        </span>
                        <span style={{ flexShrink: 0 }} title={w.word}>
                          <ChecklistStatusControl itemId={item.id} status={item.status} docCount={item.documentIds.length} />
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })
        )}

        {filter === 'all' && working.length > 0 ? (
          <div>
            <p className="av2-cl__group">Not on the checklist yet ({working.length})</p>
            <ul className="av2-cl">
              {working.map((d) => (
                <li key={d.id} className={`av2-cl__item${selected?.id === d.id ? ' av2-cl__item--current' : ''}`}>
                  <span className="av2-cl__body">{docLink(d.id, d.name)}</span>
                  <span className="av2-cl__none">{d10(d.source_uploaded_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {showArchived && archived.length > 0 ? (
          <div>
            <p className="av2-cl__group">Archived ({archived.length})</p>
            <ul className="av2-cl">
              {archived.map((d) => (
                <li key={d.id} className={`av2-cl__item${selected?.id === d.id ? ' av2-cl__item--current' : ''}`}>
                  <span className="av2-cl__body">
                    {docLink(d.id, d.name)}
                    {d.archived_reason ? <span className="av2-cl__none" style={{ display: 'block' }}>{d.archived_reason}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p style={{ margin: 'var(--a-s4) 0 0', fontSize: 'var(--a-text-sm)' }}>
          <Link href={href({ archived: !showArchived, doc: null })} style={{ color: 'var(--a-accent)' }} scroll={false}>
            {showArchived ? 'Hide archived documents' : `Show archived documents${archived.length ? ` (${archived.length})` : ''}`}
          </Link>
        </p>

        {anticipated ? (
          <details className="av2-fold" style={{ margin: 'var(--a-s4) 0 0' }}>
            <summary>
              Required by Oregon law · {anticipated.documents.filter((d) => d.present).length} of {anticipated.documents.length} on file
            </summary>
            <div className="av2-fold__body">
              <AnticipatedDocs data={anticipated} cycleId={cycle.id} />
            </div>
          </details>
        ) : null}
      </div>

      <div className="av2-split__main">
        <div className="av2-viewer">
          {selected ? (
            <>
              <div className="av2-viewer__head">
                <div style={{ minWidth: 0 }}>
                  <div className="av2-viewer__name">{selected.name}</div>
                  <div className="av2-viewer__meta">
                    {[selected.page_count ? `${selected.page_count} page${selected.page_count === 1 ? '' : 's'}` : null, kb(selected.bytes), d10(selected.source_uploaded_at) ? `uploaded ${d10(selected.source_uploaded_at)}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <div className="av2-wordrow" style={{ marginTop: 4 }}>
                    {selState ? <StateWord state={selState.state}>{selState.word}</StateWord> : null}
                    {selected.archived ? <StateWord state="waiting">Archived</StateWord> : null}
                    {selected.client_visible ? <StateWord state="accent">Shared with client</StateWord> : null}
                    {selected.is_broker_notes ? <StateWord state="accent">Broker notes</StateWord> : null}
                  </div>
                </div>
                <div className="av2-viewer__actions">
                  <DownloadButton documentId={selected.id} disabled={!selected.storage_path} />
                  <ArchiveToggle documentId={selected.id} archived={selected.archived} docName={selected.name} />
                  <ShareToggle documentId={selected.id} clientVisible={selected.client_visible} docName={selected.name} />
                </div>
              </div>
              {read || itemsForSelected.length ? (
                <div className="av2-viewer__evidence">
                  {read?.forms.map((f, i) => (
                    <p key={`f${i}`}>
                      <b>{f.title}</b>
                      {f.signed.length ? ` · signed: ${f.signed.join(', ')}` : ''}
                      {f.waiting.length ? ` · waiting on: ${f.waiting.join(', ')}` : ''}
                      {f.note ? ` · ${f.note}` : ''}
                    </p>
                  ))}
                  {read?.checks.map((c, i) => (
                    <p key={`c${i}`} style={{ color: 'var(--a-text-2)' }}>
                      {c}
                    </p>
                  ))}
                  {itemsForSelected.map((it) => (
                    <div key={it.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
                      <span>
                        On the checklist as <b>{it.name}</b> · {CHECKLIST_WORD[it.status]?.word ?? it.status}
                      </span>
                      {superuser && it.status === 'in_review' ? <SignOffControls itemId={it.id} /> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {selected.storage_path ? (
                <DocViewer documentId={selected.id} name={selected.name} />
              ) : (
                <div className="av2-viewer__empty">This document has no stored file to show.</div>
              )}
            </>
          ) : (
            <div className="av2-viewer__empty">
              No document on this cycle yet. Upload one on the left, or it arrives by email: mail about this property files here by itself.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
