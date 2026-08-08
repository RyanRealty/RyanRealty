'use client'

/**
 * automations-list-bits — stateless row/card/folder-card presentation for
 * AutomationsListView, extracted in 11F so that file stays under the
 * 600-LOC budget (ci:file-size-budget). Splitting the file is the fix the
 * gate asks for; re-baselining a ~900-line component is not.
 *
 * Every piece here is driven entirely by props — no local state, no direct
 * server-action calls. The parent (AutomationsListView) owns all state
 * (search/sort/optimistic status/dialogs) and passes precomputed values +
 * callbacks down.
 */
import type { CSSProperties } from 'react'
import { ChevronDown, Folder, MoreHorizontal } from 'lucide-react'
import { Button, FilterChip, Menu, Switch, type AdminMenuItem } from '@/components/admin/v2'

export type WorkflowPlanType = 'buyer' | 'seller' | 'expired' | 'fsbo' | null

export type AutomationFolderItem = {
  id: number
  name: string
  isSystem: boolean
  memberCount: number
}

export type AutomationListRow = {
  id: number
  name: string
  status: string
  stepCount: number
  planType: WorkflowPlanType
  isAutoEnrollMaster: boolean
  /** Other automations that reference this one via Run Automation (§12.2.3 col 2). */
  usedBy: Array<{ id: number; name: string }>
  /** Total contacts ever enrolled (§12.2.3 "Started"). */
  started: number
  /** Contacts with an email open/reply on this automation; null = unreadable (§0). */
  engaged: number | null
  completed: number
  createdByName: string
  createdByAvatarUrl: string | null
  /** Pre-formatted server-side (hydration-safe) M/D/YYYY per shot-34. */
  createdOnLabel: string
  createdAtMs: number
  folderId: number | null
}

/** §12.2.3 Engaged format: null → em-dash placeholder, 0 → "0%", else "N+ P%". */
export function engagedLabel(engaged: number | null, started: number): string {
  if (engaged == null) return '—'
  if (engaged === 0) return '0%'
  const pct = started > 0 ? Math.round((engaged / started) * 100) : 0
  return `${engaged}+ ${pct}%`
}

const PLAN_BADGES: Record<Exclude<WorkflowPlanType, null>, string> = {
  buyer: 'Default buyer',
  seller: 'Default seller',
  expired: 'Default expired',
  fsbo: 'Default FSBO',
}

/** Badge substitution (11F recipe): a static label, never a status pill. */
const badgeStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
  whiteSpace: 'nowrap',
}

/** A quiet, unbordered link-styled control for an onClick-driven "door" —
 *  same visual role as the ReportGrid entity-name Links (color:var(--a-accent)),
 *  but router.push()-driven rather than an <a href>, so it stays a <button>. */
const linkBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--a-accent)',
  cursor: 'pointer',
  textAlign: 'left',
}

/** Deterministic initials avatar — the v2 barrel has no Avatar primitive
 *  (components/admin/crm avatar-utils.ts is blacklisted legacy design input
 *  for admin v2). Mirrors the exact initials computation the shadcn Avatar
 *  fallback used: first letter of every space-separated part, joined, first
 *  two characters. Renders the real headshot when one is on file. */
export function AutomationAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: '50%',
        flexShrink: 0,
        background: 'var(--a-inset)',
        color: 'var(--a-text-2)',
        fontSize: 'var(--a-text-xs)',
        fontWeight: 600,
      }}
    >
      {initials}
    </span>
  )
}

// ── Folder card (§12.2.2 / shot-34) ─────────────────────────────────────────────

export function AutomationFolderCard({
  folder,
  active,
  onToggle,
  onRename,
  onDelete,
}: {
  folder: AutomationFolderItem
  active: boolean
  onToggle: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={active ? undefined : 'av2-automation-foldercard'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--a-s2)',
        borderRadius: 'var(--a-r-lg)',
        border: active ? '1px solid var(--a-accent)' : '1px solid var(--a-border)',
        background: 'var(--a-bg)',
        padding: '8px 12px',
        transition: 'border-color var(--a-t-fast)',
      }}
    >
      <FilterChip
        pressed={active}
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--a-s2)',
          background: 'none',
          border: 'none',
          borderRadius: 0,
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Folder size={18} aria-hidden style={{ color: 'var(--a-warn)', flexShrink: 0 }} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
            {folder.name}
          </span>
          <span
            className="a-num"
            style={{ display: 'block', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
          >
            {folder.memberCount} {folder.memberCount === 1 ? 'Automation' : 'Automations'}
          </span>
        </span>
      </FilterChip>
      {!folder.isSystem ? (
        <Menu
          label={`Manage folder ${folder.name}`}
          trigger={<MoreHorizontal size={14} />}
          items={[
            { label: 'Rename', onSelect: onRename },
            { label: 'Delete', danger: true, onSelect: onDelete },
          ]}
        />
      ) : null}
    </div>
  )
}

// ── Automation row (§12.2.3) — shared props for the desktop grid row and the
// phone card; both are pure functions of props, no local state. ────────────────

export type AutomationRowProps = {
  row: AutomationListRow
  isActive: boolean
  isArchived: boolean
  pending: boolean
  onOpenEditor: () => void
  onOpenWorkflows: () => void
  onToggleStatus: (checked: boolean) => void
  rowMenuItems: AdminMenuItem[]
  linkedMenuItems: AdminMenuItem[]
}

export function AutomationDesktopRow({
  row,
  isActive,
  isArchived,
  pending,
  onOpenEditor,
  onOpenWorkflows,
  onToggleStatus,
  rowMenuItems,
  linkedMenuItems,
}: AutomationRowProps) {
  return (
    <div role="row" className="av2-rgrid__row">
      <span role="cell" data-label="" className="av2-rgrid__c">
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Button
            variant="quiet"
            title={row.name}
            onClick={onOpenEditor}
            style={{
              ...linkBtnStyle,
              fontWeight: 600,
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block',
              minHeight: 'auto',
            }}
          >
            {row.name}
          </Button>
          {row.planType ? <span style={badgeStyle}>{PLAN_BADGES[row.planType]}</span> : null}
        </span>
      </span>

      <span role="cell" data-label="Linked Automations" className="av2-rgrid__c">
        {row.usedBy.length > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              Using: {row.usedBy.length}
            </span>
            <Menu
              label={`Used by ${row.usedBy.length} automations`}
              align="start"
              trigger={<ChevronDown size={14} />}
              items={linkedMenuItems}
            />
          </span>
        ) : (
          <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>None</span>
        )}
      </span>

      <span role="cell" data-label="Steps" className="av2-rgrid__c av2-rgrid__c--n a-num">
        {row.stepCount}
      </span>

      <span role="cell" data-label="Started" className="av2-rgrid__c av2-rgrid__c--n a-num">
        {row.started > 0 ? (
          <Button
            variant="quiet"
            title="Open the enrollment board"
            onClick={onOpenWorkflows}
            style={{ ...linkBtnStyle, display: 'inline-block', minHeight: 'auto' }}
          >
            {row.started}
          </Button>
        ) : (
          <span style={{ color: 'var(--a-text-2)' }}>0</span>
        )}
      </span>

      <span role="cell" data-label="Engaged" className="av2-rgrid__c av2-rgrid__c--n a-num">
        {engagedLabel(row.engaged, row.started)}
      </span>

      <span role="cell" data-label="Completed" className="av2-rgrid__c av2-rgrid__c--n a-num">
        {row.completed > 0 ? (
          <Button
            variant="quiet"
            title="Open the enrollment board"
            onClick={onOpenWorkflows}
            style={{ ...linkBtnStyle, display: 'inline-block', minHeight: 'auto' }}
          >
            {row.completed}
          </Button>
        ) : (
          <span style={{ color: 'var(--a-text-2)' }}>0</span>
        )}
      </span>

      <span role="cell" data-label="Created By" className="av2-rgrid__c">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AutomationAvatar name={row.createdByName} url={row.createdByAvatarUrl} />
          <span
            title={row.createdByName}
            style={{
              maxWidth: 112,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'var(--a-text-sm)',
              color: 'var(--a-text)',
            }}
          >
            {row.createdByName}
          </span>
        </span>
      </span>

      <span role="cell" data-label="Status" className="av2-rgrid__c">
        {isArchived ? (
          <span style={badgeStyle}>Archived</span>
        ) : (
          <Switch
            label={`${row.name} is ${isActive ? 'enabled' : 'disabled'}`}
            labelHidden
            checked={isActive}
            disabled={pending}
            onChange={(e) => onToggleStatus(e.target.checked)}
          />
        )}
      </span>

      <span role="cell" data-label="Created On" className="av2-rgrid__c a-num">
        {row.createdOnLabel}
      </span>

      <span role="cell" data-label="Actions" className="av2-rgrid__c" style={{ textAlign: 'right' }}>
        <Menu
          label={`Actions for ${row.name}`}
          trigger={<MoreHorizontal size={16} />}
          items={rowMenuItems}
        />
      </span>
    </div>
  )
}

export function AutomationCard({
  row,
  isActive,
  isArchived,
  pending,
  onOpenEditor,
  onToggleStatus,
  rowMenuItems,
  linkedMenuItems,
}: AutomationRowProps) {
  return (
    <div className="av2-pane">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <Button
            variant="quiet"
            onClick={onOpenEditor}
            style={{
              ...linkBtnStyle,
              fontWeight: 600,
              fontSize: 'var(--a-text-md)',
              display: 'inline-block',
              minHeight: 'auto',
            }}
          >
            {row.name}
          </Button>
          {row.planType ? (
            <div style={{ marginTop: 4 }}>
              <span style={badgeStyle}>{PLAN_BADGES[row.planType]}</span>
            </div>
          ) : null}
        </div>
        {isArchived ? (
          <span style={badgeStyle}>Archived</span>
        ) : (
          <Switch
            label={`${row.name} is ${isActive ? 'enabled' : 'disabled'}`}
            labelHidden
            checked={isActive}
            disabled={pending}
            onChange={(e) => onToggleStatus(e.target.checked)}
          />
        )}
      </div>

      <div className="av2-wordrow" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        <span className="a-num">{row.stepCount} steps</span>
        <span aria-hidden="true">·</span>
        <span className="a-num">{row.started} started</span>
        <span aria-hidden="true">·</span>
        <span className="a-num">{engagedLabel(row.engaged, row.started)} engaged</span>
        <span aria-hidden="true">·</span>
        <span className="a-num">{row.completed} completed</span>
      </div>

      {row.usedBy.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            Using: {row.usedBy.length}
          </span>
          <Menu
            label={`Used by ${row.usedBy.length} automations`}
            trigger={<ChevronDown size={14} />}
            items={linkedMenuItems}
          />
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <AutomationAvatar name={row.createdByName} url={row.createdByAvatarUrl} />
          <span
            className="a-num"
            style={{
              fontSize: 'var(--a-text-xs)',
              color: 'var(--a-text-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.createdByName} · {row.createdOnLabel}
          </span>
        </span>
        <Menu
          label={`Actions for ${row.name}`}
          trigger={<MoreHorizontal size={16} />}
          items={rowMenuItems}
        />
      </div>
    </div>
  )
}
