// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/crm/settings/templates — Email & Text Templates (§13 rebuild).
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
 */
import { redirect } from 'next/navigation'
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
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { TemplateFolderList, type TemplateFolderSummary } from '@/components/admin/crm/settings/templates/TemplateFolderList'
import { EmailTemplateList } from '@/components/admin/crm/settings/templates/EmailTemplateList'
import { TextTemplateList } from '@/components/admin/crm/settings/templates/TextTemplateList'
import type { TemplatesShared } from '@/components/admin/crm/settings/templates/template-actions'
import { cn } from '@/lib/utils'

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

  return (
    <SettingsSubpageShell
      wide
      title="Email & text templates"
      description="The reusable copy the composer, bulk sends, and automation steps draw from. Merge fields resolve to real contact + agent data at send time. Edited copy runs the brand-voice gate."
    >
      {/* §13 sub-nav: Email Templates | Text Templates */}
      <div className="mb-5 flex items-center gap-1 border-b border-border">
        {(
          [
            { t: 'email', label: 'Email Templates' },
            { t: 'text', label: 'Text Templates' },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.t}
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              'rounded-b-none border-b-2 border-transparent',
              type === tab.t
                ? 'border-primary font-semibold text-foreground'
                : 'text-muted-foreground',
            )}
          >
            <Link href={`/admin/crm/settings/templates?t=${tab.t}`}>{tab.label}</Link>
          </Button>
        ))}
      </div>

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
    </SettingsSubpageShell>
  )
}
