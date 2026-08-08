// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/crm/settings/templates — Email & Text Templates (§13 rebuild,
 * P11C migration onto the locked v2 admin language).
 *
 * The §13 two-level folder architecture inside ONE route (the spec's
 * /email-templates + /text-templates sub-nav pair maps to ?t=email|text —
 * the registry pins this route). URL model:
 *
 *   ?t=email|text          which section (default email)
 *   &folder=all|my|used|cat:<name>   drill into a folder (absent = folder list)
 *   &q=<search>            search templates
 *
 * Level 1 renders TemplateFolderList (Name | count | Actions); level 2 renders
 * the §13.1.2 email table or the §13.2.2 text table with the Add/Edit modals.
 * Folders are crm_templates.category values (channel-scoped) plus the derived
 * system folders (All / My / Used by Automations).
 *
 * Access: any CRM broker (templates are shared team copy — FUB parity); the
 * list is scoped at the data edge: a restricted broker sees shared templates,
 * legacy company templates (owner null), and their own. Destructive ops stay
 * superuser-gated in the actions.
 *
 * The folder/table bodies are the shared editors under
 * components/admin/crm/settings/templates/ — mounted unchanged; this file owns
 * the page shell only (ADMIN_UI.md: verdict first, one compact section switch,
 * no page-title chrome).
 */
import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmTemplatesAdmin, type CrmTemplateAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import { getCrmFieldDefinitions } from '@/lib/data/crm/getCrmFieldDefinitions'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { buildMergeContext } from '@/lib/crm/merge-context'
import {
  createTemplateAction,
  updateTemplateAction,
  setTemplateActiveAction,
  deleteTemplateAction,
  renameCategoryAction,
  moveTemplatesToFolderAction,
} from '@/app/actions/crm-templates'
import { sendTemplateSelfTestAction } from '@/app/actions/crm-template-test'
import Link from 'next/link'
import { VerdictLine } from '@/components/admin/v2'
import { TemplateFolderList, type TemplateFolderSummary } from '@/app/admin/(protected)/crm/settings/_components/templates/TemplateFolderList'
import { EmailTemplateList } from '@/app/admin/(protected)/crm/settings/_components/templates/EmailTemplateList'
import { TextTemplateList } from '@/app/admin/(protected)/crm/settings/_components/templates/TextTemplateList'
import type { TemplatesShared } from '@/app/admin/(protected)/crm/settings/_components/templates/template-actions'

export const metadata = { title: 'Templates | CRM settings' }
export const dynamic = 'force-dynamic'

type FolderParam =
  | { kind: 'all' }
  | { kind: 'my' }
  | { kind: 'used' }
  | { kind: 'cat'; name: string }

function parseFolder(raw: string | undefined): FolderParam | null {
  if (!raw) return null
  if (raw === 'all') return { kind: 'all' }
  if (raw === 'my') return { kind: 'my' }
  if (raw === 'used') return { kind: 'used' }
  if (raw.startsWith('cat:')) {
    const name = raw.slice(4).trim()
    if (name) return { kind: 'cat', name }
  }
  return null
}

export default async function CrmTemplatesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage('settings.templates')
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const type: 'email' | 'text' = sp.t === 'text' ? 'text' : 'email'
  const channel: 'email' | 'sms' = type === 'text' ? 'sms' : 'email'
  const folder = parseFolder(typeof sp.folder === 'string' ? sp.folder : undefined)
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''

  const actingSlug = access.brokerSlug ?? 'matt'
  const isSuperuser = access.role === 'superuser'

  const [allRows, fieldDefs, brokers, mergeContext] = await Promise.all([
    getCrmTemplatesAdmin(),
    getCrmFieldDefinitions(),
    getCrmBrokers(),
    buildMergeContext({
      person: { assigned_broker: access.brokerSlug ?? 'matt', lender_name: null, source: null },
      senderSlug: access.brokerSlug ?? 'matt',
    }),
  ])

  // Visibility scope at the data edge: a restricted broker sees shared
  // templates, legacy company templates (owner null), and their own. The
  // superuser sees everything.
  const visible = isSuperuser
    ? allRows
    : allRows.filter((r) => r.isShared || r.ownerBroker === null || r.ownerBroker === actingSlug)

  const rowsOfType = visible.filter((r) => r.channel === channel)
  const isMine = (r: CrmTemplateAdmin) => r.ownerBroker === null || r.ownerBroker === actingSlug

  // Folder model (channel-scoped): system folders + the category folders.
  const categories = [...new Set(rowsOfType.map((r) => (r.category ?? '').trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  )
  const noun = type === 'email' ? 'Email Template' : 'Text Template'
  const folders: TemplateFolderSummary[] = [
    { id: 'all', name: `All ${noun}s`, count: rowsOfType.length, system: true },
    { id: 'my', name: `My ${noun}s`, count: rowsOfType.filter(isMine).length, system: true },
    ...(type === 'email'
      ? [{ id: 'used', name: 'Used by Automations', count: rowsOfType.filter((r) => r.usage > 0).length, system: true }]
      : []),
    ...categories.map((name) => ({
      id: `cat:${name}`,
      name,
      count: rowsOfType.filter((r) => (r.category ?? '').trim() === name).length,
      system: false,
    })),
  ]

  // Level-2 rows: folder filter + search.
  function rowsForFolder(f: FolderParam): CrmTemplateAdmin[] {
    let out = rowsOfType
    if (f.kind === 'my') out = out.filter(isMine)
    if (f.kind === 'used') out = out.filter((r) => r.usage > 0)
    if (f.kind === 'cat') out = out.filter((r) => (r.category ?? '').trim() === f.name)
    if (q) {
      const needle = q.toLowerCase()
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          (r.subject ?? '').toLowerCase().includes(needle) ||
          r.body.toLowerCase().includes(needle),
      )
    }
    return out
  }

  const folderName =
    folder?.kind === 'cat'
      ? folder.name
      : folder?.kind === 'my'
        ? `My ${noun}s`
        : folder?.kind === 'used'
          ? 'Used by Automations'
          : `All ${noun}s`

  const shared: TemplatesShared = {
    actions: {
      create: createTemplateAction,
      update: updateTemplateAction,
      setActive: setTemplateActiveAction,
      remove: deleteTemplateAction,
      renameCategory: renameCategoryAction,
      moveToFolder: moveTemplatesToFolderAction,
      testSend: sendTemplateSelfTestAction,
    },
    customFields: fieldDefs
      .filter((d) => d.key.startsWith('custom'))
      .map((d) => ({ key: d.key, label: d.label })),
    mergeContext,
    brokerNames: Object.fromEntries(brokers.map((b) => [b.slug, b.name])),
    actingSlug,
    isSuperuser,
  }

  const emailCount = visible.filter((r) => r.channel === 'email').length
  const textCount = visible.filter((r) => r.channel === 'sms').length

  const TABS = [
    { t: 'email' as const, label: 'Email Templates' },
    { t: 'text' as const, label: 'Text Templates' },
  ]

  return (
    <div className="av2-scope" style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          margin: '0 0 14px',
        }}
      >
        <VerdictLine tone="ok">
          <b>Templates.</b> {emailCount} email · {textCount} text. The composer, bulk sends, and sequence steps
          draw from here; merge fields resolve at send time and edited copy runs the brand-voice gate.
        </VerdictLine>
        <Link
          href="/admin/crm/settings"
          style={{ color: 'var(--a-accent)', textDecoration: 'none', fontSize: 'var(--a-text-sm)' }}
        >
          Back to settings
        </Link>
      </div>

      {/* §13 section switch: Email Templates | Text Templates */}
      <nav
        aria-label="Template section"
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--a-border)',
          margin: '0 0 18px',
        }}
      >
        {TABS.map((tab) => (
          <Link
            key={tab.t}
            href={`/admin/crm/settings/templates?t=${tab.t}`}
            aria-current={type === tab.t ? 'page' : undefined}
            style={{
              padding: '8px 12px',
              textDecoration: 'none',
              fontSize: 'var(--a-text-sm)',
              fontWeight: type === tab.t ? 600 : 400,
              color: type === tab.t ? 'var(--a-accent)' : 'var(--a-text-2)',
              borderBottom:
                type === tab.t ? '2px solid var(--a-accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {folder === null ? (
        <TemplateFolderList
          kind={channel}
          folders={folders}
          categories={categories}
          q={q}
          shared={shared}
        />
      ) : type === 'email' ? (
        <EmailTemplateList
          folderId={sp.folder as string}
          folderName={folderName}
          rows={rowsForFolder(folder)}
          categories={categories}
          q={q}
          shared={shared}
        />
      ) : (
        <TextTemplateList
          folderId={sp.folder as string}
          folderName={folderName}
          rows={rowsForFolder(folder)}
          categories={categories}
          q={q}
          shared={shared}
        />
      )}
    </div>
  )
}
