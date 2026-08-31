#!/usr/bin/env node
/**
 * check-admin-v2-tokens.mjs — the functional admin color gate (P7, 2026-08-05).
 *
 * The admin v2 language (design_system/admin/ADMIN_UI.md, visual lock
 * 2026-08-05) is exempt from the public-brand design-token gate. This gate is
 * what replaces it there: components/admin/v2/** must draw EVERY color from
 * the locked admin tokens.
 *
 * Rules:
 *   1. PARITY — components/admin/v2/tokens.css is byte-identical to the locked
 *      spec at design_system/admin/tokens.css. The runtime copy may not drift.
 *   2. NO RAW COLOR — outside tokens.css, no hex literals, no rgb()/hsl()/oklch()
 *      literals, and no Tailwind palette color classes anywhere under
 *      components/admin/v2/. Color reaches components only via var(--a-*).
 *   3. NO BRAND LEAK — the public brand is blacklisted as design input for the
 *      admin (amnesia, Matt 2026-08-04): no --rr-* tokens, no Amboqia, no Geist,
 *      and no imports from legacy components/admin/* (non-v2) or components/ui/*.
 *
 * Scope grows with the rollout: when P9 migrates app/admin surfaces onto v2,
 * add those paths to SCAN_DIRS.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

const ROOT = process.cwd()
const SPEC = join(ROOT, 'design_system/admin/tokens.css')
const COPY = join(ROOT, 'components/admin/v2/tokens.css')
// Entries may be directories (scanned recursively) or single files — the file
// form scopes a route whose subtree still holds un-migrated legacy machinery
// (prospecting's [kind]/[id] review page migrates with a later unit; flip the
// entry to the bare dir when it does).
const SCAN_DIRS = [
  'components/admin/v2',
  'app/admin/(protected)/today',
  'app/admin/(protected)/messages',
  // people/[id] hosts the relocated legacy workspace (tools/, portal/) and the
  // G50 composer chokepoints mounted on the v2 person fold (11B B2:
  // CommsSection mounts SmsComposer/EmailComposer, SendSection mounts
  // ContactSendCenter — sanctioned legacy imports). File-form scope the
  // pure-v2 files; flip back to the bare dir when the chokepoints migrate.
  'app/admin/(protected)/people/page.tsx',
  'app/admin/(protected)/people/actions.ts',
  'app/admin/(protected)/people/[id]/page.tsx',
  'app/admin/(protected)/people/[id]/PersonAddressEditor.tsx',
  'app/admin/(protected)/people/[id]/PersonRelationships.tsx',
  'app/admin/(protected)/people/[id]/PersonNotesAdd.tsx',
  'app/admin/(protected)/people/[id]/PersonWorkspace.tsx',
  'app/admin/(protected)/people/[id]/PersonIdentityHeader.tsx',
  'app/admin/(protected)/people/[id]/PersonAddressEditor.tsx',
  'app/admin/(protected)/people/[id]/PersonRelationships.tsx',
  'app/admin/(protected)/people/[id]/PersonNotesAdd.tsx',
  'app/admin/(protected)/people/[id]/PersonWorkspace.tsx',
  'app/admin/(protected)/people/[id]/FieldEditors.tsx',
  'app/admin/(protected)/people/[id]/TasksSection.tsx',
  'app/admin/(protected)/people/[id]/NotesSection.tsx',
  'app/admin/(protected)/people/[id]/HomesSection.tsx',
  'app/admin/(protected)/people/[id]/PersonDeals.tsx',
  'app/admin/(protected)/people/[id]/StartDealForm.tsx',
  'app/admin/(protected)/prospecting/page.tsx',
  'app/admin/(protected)/prospecting/actions.ts',
  'app/admin/(protected)/prospecting/FilterSelect.tsx',
  'app/admin/(protected)/oversight',
  'app/admin/(protected)/valuations',
  'app/admin/(protected)/closings',
  'app/admin/(protected)/reports/page.tsx',
  'app/admin/(protected)/audiences',
  'app/admin/(protected)/content',
  'app/admin/(protected)/settings/page.tsx',
  // 11C/11D/11E (2026-08-07). The admin interior migration is COMPLETE — all
  // 143 admin pages are on the v2 language and ci:admin-ui rule B reads 0
  // legacy pages. These 90 files are token-scoped here.
  //
  // The rest are deferred for ONE stated reason, not skipped: they mount client
  // islands from @/components/admin/<legacy> or @/components/ui — BpoBoard,
  // CmaBoard, DealsBoard, ProspectDetailPage, the newsletter panels,
  // ListingsCsvExport, AdminListingEditor, SignOffControls and friends — which
  // rule 3 blacklists and which the migration mounts as-is BY DESIGN, the same
  // call already recorded above for people/[id]. A page joins this list the day
  // its island migrates; the work-queue item is 11f-mounted-islands.
  'app/admin/(protected)/analytics/action-required/page.tsx',
  'app/admin/(protected)/analytics/ad-roi/page.tsx',
  'app/admin/(protected)/analytics/cost-per-lead/page.tsx',
  'app/admin/(protected)/analytics/demographics/page.tsx',
  'app/admin/(protected)/analytics/funnel-breakdown/page.tsx',
  'app/admin/(protected)/analytics/google-business-profile/page.tsx',
  'app/admin/(protected)/analytics/google-search/page.tsx',
  'app/admin/(protected)/analytics/listing-performance/page.tsx',
  'app/admin/(protected)/analytics/lp-leaderboard/page.tsx',
  'app/admin/(protected)/analytics/meta-health/page.tsx',
  'app/admin/(protected)/analytics/page.tsx',
  'app/admin/(protected)/analytics/social/page.tsx',
  'app/admin/(protected)/approval-queue/page.tsx',
  'app/admin/(protected)/audiences/page.tsx',
  'app/admin/(protected)/audit-log/page.tsx',
  'app/admin/(protected)/blog/page.tsx',
  'app/admin/(protected)/broker-links/CopyLinkButton.tsx',
  'app/admin/(protected)/broker-links/page.tsx',
  'app/admin/(protected)/brokers/edit/page.tsx',
  'app/admin/(protected)/brokers/new/page.tsx',
  'app/admin/(protected)/brokers/page.tsx',
  'app/admin/(protected)/closings/page.tsx',
  'app/admin/(protected)/commissions/page.tsx',
  'app/admin/(protected)/content/page.tsx',
  'app/admin/(protected)/crm/approvals/page.tsx',
  'app/admin/(protected)/crm/deals/[id]/page.tsx',
  'app/admin/(protected)/crm/health/page.tsx',
  'app/admin/(protected)/crm/import/[id]/page.tsx',
  'app/admin/(protected)/crm/import/new/map/page.tsx',
  'app/admin/(protected)/crm/import/new/page.tsx',
  'app/admin/(protected)/crm/import/new/preview/page.tsx',
  'app/admin/(protected)/crm/import/page.tsx',
  'app/admin/(protected)/crm/new/page.tsx',
  'app/admin/(protected)/crm/referrals/page.tsx',
  // 11F (2026-08-08) — the reporting family, BARE DIR (not file-form): its
  // mounted islands migrated with it, so there is nothing left in the subtree to
  // carve around, and a new file under it is covered the day it lands. The
  // shared sub-nav and the shared broker+date filter now live in
  // crm/reporting/_components/ instead of components/admin/crm/reporting/.
  'app/admin/(protected)/crm/reporting',
  // 11F (2026-08-08) — operations, BARE DIR: its nine Dashboard*Panel islands
  // moved into the route's own _components/ on the v2 language, so nothing in
  // the subtree imports legacy any more.
  'app/admin/(protected)/operations',
  // 11F (2026-08-08) — crm/inbox. FILE-FORM, and the exclusions are the whole
  // point: InlineReply, MobileThread and MobileComposeSheet mount the canonical
  // SmsComposer / EmailComposer that ci:composer-discipline REQUIRES. A surface
  // that SENDS is gated AROUND its composer, never through it — forking the one
  // send interface to satisfy a colour gate would defeat the gate that matters
  // more. Same call as people/[id], email/compose and dscr. Everything else in
  // the family is listed here, so a new file under it is a deliberate decision
  // rather than a silent gap.
  'app/admin/(protected)/crm/inbox/page.tsx',
  'app/admin/(protected)/crm/inbox/_components/AddPersonForm.tsx',
  'app/admin/(protected)/crm/inbox/_components/ComposeButton.tsx',
  'app/admin/(protected)/crm/inbox/_components/ContactSidebar.tsx',
  'app/admin/(protected)/crm/inbox/_components/InboxFolderRail.tsx',
  'app/admin/(protected)/crm/inbox/_components/InboxThreadList.tsx',
  'app/admin/(protected)/crm/inbox/_components/InboxThreadView.tsx',
  'app/admin/(protected)/crm/inbox/_components/NoteTray.tsx',
  'app/admin/(protected)/crm/inbox/_components/ThreadHeader.tsx',
  'app/admin/(protected)/crm/inbox/_components/inbox-url.ts',
  'app/admin/(protected)/crm/inbox/_components/mobile/MobileAiPills.tsx',
  'app/admin/(protected)/crm/inbox/_components/mobile/MobileBranch.tsx',
  'app/admin/(protected)/crm/inbox/_components/mobile/MobileInbox.tsx',
  'app/admin/(protected)/crm/inbox/_components/mobile/MobileInboxRow.tsx',
  'app/admin/(protected)/crm/inbox/_components/mobile/mobile-data.ts',
  'app/admin/(protected)/crm/inbox/_components/mobile/thread-bits.tsx',
  // 11F (2026-08-08) — dscr + content-library, whose islands moved into their
  // own routes. dscr is FILE-FORM, not bare dir: its DscrEmailDialog mounts the
  // G50 EmailBodyEditor chokepoint that ci:composer-discipline requires, and
  // forking that to satisfy a color gate would defeat the gate that matters
  // more — the same sanctioned call recorded above for people/[id] and
  // email/compose. NOT prospecting/[kind]/[id]: its wrapper migrated, but the
  // wrapper mounts six more legacy islands (ProspectDetailPanel,
  // ProspectSendDialog, ProspectComplianceRibbon, ProspectDocPill, ProspectMap,
  // ProspectPriceHistory — 1,134 lines including a send path), so that page
  // joins when its sub-family does.
  'app/admin/(protected)/dscr/page.tsx',
  'app/admin/(protected)/dscr/_components/DscrScreen.client.tsx',
  'app/admin/(protected)/content-library',
  // 11F (2026-08-08) — the three ConfigTableEditor consumers. File-form, not the
  // bare crm/settings dir: eleven sibling pages still mount legacy editors
  // (CustomFieldEditor, TagTaxonomyEditor, the company + templates islands).
  // Each joins this list as its island migrates.
  // 11F (2026-08-08) — crm/deals + newsletters islands. NEITHER newsletter PAGE
  // is listed, and that is the honest state: both mount components that live at
  // the ROUTE ROOT (NewsletterComposeForm, NewsletterDraftActions, BulkOneOffForm,
  // SubscriberForms, BulkEnrollForm, GenerateDraftButton) which were never in
  // components/admin/newsletter and so were never in this migration's scope.
  // /admin/newsletters/subscribers still renders 10 shadcn classes from them.
  // Gating those pages now would be green for the wrong reason. The ISLANDS
  // below are clean and gated; the six route-root files are queued.
  //
  // THE SCOPING LESSON: a relocation-driven unit only sees files under
  // components/admin/<family>. Files ALREADY sitting in the route were invisible
  // to it. Check the route directory itself, not just what moves into it.
  // crm/deals* are redirect bridges to Closings (Track 2 P3). The kanban
  // islands were deleted 2026-08-14 and are gated absent in check-dead-ui.
  'app/admin/(protected)/newsletters/_components/NewsletterPreviewPanel.tsx',
  'app/admin/(protected)/newsletters/_components/NewsletterScheduleControls.tsx',
  'app/admin/(protected)/newsletters/_components/SubscriberFilters.tsx',
  'app/admin/(protected)/newsletters/_components/SubscriberRowActions.tsx',
  'app/admin/(protected)/crm/deals/pipelines/page.tsx',
  // 11F (2026-08-08) — the valuations family (bpo + cmas). FILE-FORM: the two
  // Send dialogs mount EmailBodyEditor, the G50 compose chokepoint
  // ci:composer-discipline requires. Everything else in both families is listed,
  // so a new file under either is a deliberate decision rather than a silent gap.
  'app/admin/(protected)/bpo/_components/BpoReviewActions.tsx',
  'app/admin/(protected)/bpo/_components/BuildBpoForm.tsx',
  'app/admin/(protected)/bpo/_components/worklist/BpoBoard.client.tsx',
  'app/admin/(protected)/bpo/_components/worklist/BpoCard.client.tsx',
  'app/admin/(protected)/bpo/_components/worklist/BpoDetailDrawer.client.tsx',
  'app/admin/(protected)/bpo/_components/worklist/BpoDetailPanel.client.tsx',
  'app/admin/(protected)/bpo/_components/worklist/BpoFilters.client.tsx',
  'app/admin/(protected)/bpo/_components/worklist/BpoStatusPill.client.tsx',
  'app/admin/(protected)/bpo/_components/worklist/format.ts',
  'app/admin/(protected)/cmas/_components/BuildCmaForm.tsx',
  'app/admin/(protected)/cmas/_components/CmaPublishControl.tsx',
  'app/admin/(protected)/cmas/_components/CmaReviewActions.tsx',
  'app/admin/(protected)/cmas/_components/worklist/CmaBoard.client.tsx',
  'app/admin/(protected)/cmas/_components/worklist/CmaCard.client.tsx',
  'app/admin/(protected)/cmas/_components/worklist/CmaDetailPanel.client.tsx',
  'app/admin/(protected)/cmas/_components/worklist/CmaFilters.client.tsx',
  'app/admin/(protected)/cmas/_components/worklist/CmaStatusPill.client.tsx',
  'app/admin/(protected)/cmas/_components/worklist/format.ts',
  'app/admin/(protected)/cmas/_components/worklist/types.ts',
  'app/admin/(protected)/bpo/page.tsx',
  'app/admin/(protected)/bpo/new/page.tsx',
  'app/admin/(protected)/bpo/[slug]/page.tsx',
  'app/admin/(protected)/cmas/page.tsx',
  'app/admin/(protected)/cmas/new/page.tsx',
  'app/admin/(protected)/cmas/[slug]/page.tsx',
  // 11F (2026-08-08) — crm/sequences + crm/tasks. FILE-FORM: MobileTasksScreen
  // mounts CrmAvatar and MobileTaskCreateSheet from components/admin/shared/mobile,
  // which are genuinely cross-cutting — CrmMobileKit has EIGHT importers
  // (settings, inbox, tasks, BrokerScopeSheet, MobilePeopleRoot,
  // MobileContactDetail, calendar) and MobileTaskCreateSheet is shared with the
  // calendar. Verified by importer list, not asserted. Same rule as the send and
  // compose surfaces: gate AROUND shared machinery, never through it.
  'app/admin/(protected)/crm/sequences/_components/AutomationEditor.tsx',
  'app/admin/(protected)/crm/sequences/_components/AutomationRulesManager.tsx',
  'app/admin/(protected)/crm/sequences/_components/AutomationsListView.tsx',
  'app/admin/(protected)/crm/sequences/_components/EditorCanvas.tsx',
  'app/admin/(protected)/crm/sequences/_components/EditorPalette.tsx',
  'app/admin/(protected)/crm/sequences/_components/StepConfigPanel.tsx',
  'app/admin/(protected)/crm/sequences/_components/automation-rules-bits.tsx',
  'app/admin/(protected)/crm/sequences/_components/automations-list-bits.tsx',
  'app/admin/(protected)/crm/sequences/_components/editor-shared.ts',
  'app/admin/(protected)/crm/sequences/_components/step-config-bits.tsx',
  'app/admin/(protected)/crm/sequences/_components/step-config-body-bits.tsx',
  'app/admin/(protected)/crm/tasks/_components/NewTaskDialog.tsx',
  'app/admin/(protected)/crm/tasks/_components/TasksView.tsx',
  'app/admin/(protected)/crm/tasks/_components/mobile/mobile-tasks-bits.tsx',
  'app/admin/(protected)/crm/tasks/_components/tasks-view-bits.tsx',
  'app/admin/(protected)/crm/sequences/page.tsx',
  'app/admin/(protected)/crm/sequences/[id]/edit/page.tsx',
  'app/admin/(protected)/crm/tasks/page.tsx',
  // 11F (2026-08-08) — the crm/settings family, FILE-FORM so the exclusions are
  // named rather than implied. EmailTemplateModal, TextTemplateModal and
  // template-actions import MergeFieldInserter from components/admin/crm: that is
  // the shared merge-field machinery every compose surface uses, and forking it
  // to satisfy a colour gate would fork what a broker's templates render. Same
  // call as people/[id], email/compose, dscr and crm/inbox — a surface that
  // COMPOSES is gated around its shared machinery, never through it.
  'app/admin/(protected)/crm/settings/_components/AddRowDialog.tsx',
  'app/admin/(protected)/crm/settings/_components/ConfigTableEditor.tsx',
  'app/admin/(protected)/crm/settings/_components/CustomFieldEditor.tsx',
  'app/admin/(protected)/crm/settings/_components/GroupEditor.tsx',
  'app/admin/(protected)/crm/settings/_components/LeadFlowEditor.tsx',
  'app/admin/(protected)/crm/settings/_components/MarketReportPreviewDialog.tsx',
  'app/admin/(protected)/crm/settings/_components/PondEditor.tsx',
  'app/admin/(protected)/crm/settings/_components/RenameRowDialog.tsx',
  'app/admin/(protected)/crm/settings/_components/RoutingEditor.tsx',
  'app/admin/(protected)/crm/settings/_components/SuppressionAdmin.tsx',
  'app/admin/(protected)/crm/settings/_components/TagTaxonomyEditor.tsx',
  'app/admin/(protected)/crm/settings/_components/TemplatePreviewPane.tsx',
  'app/admin/(protected)/crm/settings/_components/company/BlockListManager.tsx',
  'app/admin/(protected)/crm/settings/_components/company/ChangeDialogs.tsx',
  'app/admin/(protected)/crm/settings/_components/company/CompanySettingsForm.tsx',
  'app/admin/(protected)/crm/settings/_components/company/OfficeHoursEditor.tsx',
  'app/admin/(protected)/crm/settings/_components/company/WeeklyRecipientsEditor.tsx',
  'app/admin/(protected)/crm/settings/_components/company/form-shared.tsx',
  'app/admin/(protected)/crm/settings/_components/templates/EmailTemplateList.tsx',
  'app/admin/(protected)/crm/settings/_components/templates/EmojiPickerButton.tsx',
  'app/admin/(protected)/crm/settings/_components/templates/RichTextBody.tsx',
  'app/admin/(protected)/crm/settings/_components/templates/TemplateFolderList.tsx',
  'app/admin/(protected)/crm/settings/_components/templates/TemplatePerfScore.tsx',
  'app/admin/(protected)/crm/settings/_components/templates/TemplatesToolbar.tsx',
  'app/admin/(protected)/crm/settings/_components/templates/TextTemplateList.tsx',
  'app/admin/(protected)/crm/settings/assignment/page.tsx',
  'app/admin/(protected)/crm/settings/company/block-list/page.tsx',
  'app/admin/(protected)/crm/settings/company/page.tsx',
  'app/admin/(protected)/crm/settings/custom-fields/page.tsx',
  'app/admin/(protected)/crm/settings/groups/page.tsx',
  'app/admin/(protected)/crm/settings/lead-flows/page.tsx',
  'app/admin/(protected)/crm/settings/market-reports/page.tsx',
  'app/admin/(protected)/crm/settings/ponds/page.tsx',
  'app/admin/(protected)/crm/settings/suppression/page.tsx',
  'app/admin/(protected)/crm/settings/tags/page.tsx',
  'app/admin/(protected)/crm/settings/templates/page.tsx',
  'app/admin/(protected)/crm/settings/stages/page.tsx',
  'app/admin/(protected)/crm/settings/segments/page.tsx',
  'app/admin/(protected)/crm/settings/areas/page.tsx',
  'app/admin/(protected)/crm/settings/appointments/page.tsx',
  'app/admin/(protected)/crm/settings/brokers/page.tsx',
  'app/admin/(protected)/crm/settings/brokers/SmsAgentToggle.tsx',
  'app/admin/(protected)/crm/settings/company/registration/page.tsx',
  'app/admin/(protected)/crm/settings/page.tsx',
  'app/admin/(protected)/crm/settings/team/page.tsx',
  'app/admin/(protected)/crm/workflows/page.tsx',
  'app/admin/(protected)/deals/[key]/page.tsx',
  'app/admin/(protected)/email/campaigns/page.tsx',
  'app/admin/(protected)/financials/page.tsx',
  'app/admin/(protected)/forms/page.tsx',
  'app/admin/(protected)/forms/CheckFormCatalog.tsx',
  'app/admin/(protected)/forms/UseFormOnDeal.tsx',
  'app/admin/(protected)/forms/FormsLibraryExtras.tsx',
  'app/admin/(protected)/forms/ReplaceFormBlank.tsx',
  'app/admin/(protected)/forms/RebuildLibraryMaps.tsx',
  'app/admin/(protected)/geo/area-guide-upload/page.tsx',
  'app/admin/(protected)/geo/page.tsx',
  'app/admin/(protected)/geo/resort-communities/page.tsx',
  'app/admin/(protected)/guides/page.tsx',
  'app/admin/(protected)/help/HelpSearch.tsx',
  'app/admin/(protected)/help/[slug]/page.tsx',
  'app/admin/(protected)/help/page.tsx',
  'app/admin/(protected)/listings/ListingsStatusFilter.tsx',
  'app/admin/(protected)/listings/[listingKey]/page.tsx',
  'app/admin/(protected)/listings/page.tsx',
  'app/admin/(protected)/media/banners/page.tsx',
  'app/admin/(protected)/media/page.tsx',
  'app/admin/(protected)/media/photos/page.tsx',
  'app/admin/(protected)/media/stock-photos/page.tsx',
  'app/admin/(protected)/messages/page.tsx',
  'app/admin/(protected)/newsletters/analytics/page.tsx',
  'app/admin/(protected)/newsletters/enroll/page.tsx',
  'app/admin/(protected)/newsletters/new/page.tsx',
  'app/admin/(protected)/newsletters/page.tsx',
  'app/admin/(protected)/oversight/page.tsx',
  'app/admin/(protected)/people/[id]/page.tsx',
  'app/admin/(protected)/people/page.tsx',
  'app/admin/(protected)/prospecting/page.tsx',
  'app/admin/(protected)/reports/brokers/page.tsx',
  'app/admin/(protected)/reports/cma-performance/page.tsx',
  'app/admin/(protected)/reports/custom/page.tsx',
  'app/admin/(protected)/reports/emails/page.tsx',
  'app/admin/(protected)/reports/lead-flow/page.tsx',
  'app/admin/(protected)/reports/leads/page.tsx',
  'app/admin/(protected)/reports/market/page.tsx',
  'app/admin/(protected)/reports/page.tsx',
  'app/admin/(protected)/reports/traffic-sources/page.tsx',
  'app/admin/(protected)/settings/page.tsx',
  'app/admin/(protected)/sign-off/page.tsx',
  'app/admin/(protected)/signing/[envelopeId]/page.tsx',
  'app/admin/(protected)/signing/page.tsx',
  'app/admin/(protected)/site-pages/page.tsx',
  'app/admin/(protected)/sync/page.tsx',
  'app/admin/(protected)/sync/spark/page.tsx',
  'app/admin/(protected)/today/page.tsx',
  'app/admin/(protected)/users/page.tsx',
  'app/admin/(protected)/valuations/page.tsx',
  'app/admin/(protected)/visitors/VisitorFilterSelect.tsx',
  'app/admin/(protected)/visitors/[sessionId]/page.tsx',
  'app/admin/(protected)/visitors/live/page.tsx',
  'app/admin/access-denied/page.tsx',
  // 11F (2026-08-08) — the two auth-door islands, moved into their route's own
  // _components/ (components/admin/AdminLoginForm.tsx / AdminSetupClient.tsx
  // no longer exist). Both are clean: no legacy imports, no raw color.
  'app/admin/login/page.tsx',
  'app/admin/login/_components/AdminLoginForm.tsx',
  'app/admin/setup/page.tsx',
  'app/admin/setup/_components/AdminSetupClient.tsx',
  // 11F (2026-08-08) — email/compose, file-form not bare dir: the page itself
  // is clean, but its two islands (AdminEmailCompose.tsx, ComposeToCohort.tsx,
  // now under _components/) mount the G50 compose chokepoints (EmailComposer /
  // EmailBodyEditor) and the BulkProgress poller AS-IS BY DESIGN — the same
  // sanctioned-legacy-import call already recorded above for people/[id]'s
  // CommsSection.tsx / SendSection.tsx. Add the two islands here only if they
  // stop mounting those.
  'app/admin/(protected)/email/compose/page.tsx',

  // ── components/admin/shared (11F decision 1) ────────────────────────────
  // Held to the same token rules as v2, in FILE form rather than the bare dir
  // because three files still import legacy components/admin/* and would fail
  // rule 3. They are named in the exclusion note below and in that directory's
  // README; the gate covers the other 24.

  'components/admin/shared/mobile/CrmMobileKit.tsx',
  'components/admin/shared/mobile/MobileActivityTab.tsx',
  'components/admin/shared/mobile/MobileAssignToSheet.tsx',
  'components/admin/shared/mobile/MobileContactDetail.tsx',
  'components/admin/shared/mobile/MobileContactPointsSection.tsx',
  'components/admin/shared/mobile/MobileDetailsSection.tsx',
  'components/admin/shared/mobile/MobileEditSheet.tsx',
  'components/admin/shared/mobile/MobileHomesTab.tsx',
  'components/admin/shared/mobile/MobileInfoTab.tsx',
  'components/admin/shared/mobile/MobileNotesTab.tsx',
  'components/admin/shared/mobile/MobilePeopleRoot.tsx',
  'components/admin/shared/mobile/MobilePickerSheet.tsx',
  'components/admin/shared/mobile/MobileTaskCreateSheet.tsx',
  'components/admin/shared/mobile/task-type-icons.tsx',
  'components/admin/shared/people-list/AddPersonDialog.tsx',
  'components/admin/shared/people-list/ColumnChooser.tsx',
  'components/admin/shared/people-list/ExportPeopleDialog.tsx',
  'components/admin/shared/people-list/FilterPanel.tsx',
  'components/admin/shared/people-list/PeopleSidebar.tsx',
  'components/admin/shared/people-list/ScopeDropdown.tsx',
  'components/admin/shared/people-list/people-list-utils.test.ts',
  'components/admin/shared/people-list/people-list-utils.ts',
  'components/admin/shared/people-list/saved-view-grouping.test.ts',
  'components/admin/shared/people-list/saved-view-grouping.ts',

  // NOT SCANNED, and each for a reason that is not 'we gave up':
  //   mobile/MobileCalendarTab.tsx  -> crm/calendar/AppointmentSheet
  //   mobile/MobileCommsTab.tsx     -> crm/ConversationFeed
  //   people-list/PeopleListView.tsx-> crm/BulkActions
  // Each imports a legacy component that has not been migrated. BulkActions is
  // the hard one: it drags bulk/registry -> EmailBodyEditor -> MergeFieldInserter,
  // and ci:composer-discipline hard-codes those PATHS in a regex, so relocating
  // them silently disarms G50. Migrate the three legacy components, then move
  // these three lines up into the list above.

  // ── 11F FINAL SWEEP (2026-08-09) ────────────────────────────────────────
  // Unblocked by decision 1: components/admin/shared is now a sanctioned import
  // source, so pages that mount the shared CRM machinery stop tripping rule 3.
  //
  // EVERY entry below was chosen by checking the page's WHOLE TRANSITIVE RENDER
  // TREE — not just its page.tsx. That distinction is why /admin/crm is NOT
  // here: its own file is clean, but PeopleListView still reaches BulkActions
  // and MobileCommsTab still reaches ConversationFeed. A page whose file passes
  // while its islands render shadcn is the 'green for the wrong reason' failure
  // this phase exists to avoid, and newsletters was un-gated for exactly that.
  //
  // Bare dir wherever the whole subtree is clean AND holds no nested page.tsx,
  // so a new file under it is covered the day it lands.

  'app/admin/(protected)/banners',
  'app/admin/(protected)/bpo/[slug]',
  'app/admin/(protected)/bpo/new',
  'app/admin/(protected)/broker-dashboard',
  'app/admin/(protected)/cmas/[slug]',
  'app/admin/(protected)/cmas/new',
  'app/admin/(protected)/crm/[id]/portal',
  'app/admin/(protected)/crm/automations',
  'app/admin/(protected)/crm/deals/pipelines',
  'app/admin/(protected)/crm/sequences/[id]/edit',
  'app/admin/(protected)/crm/tasks',
  'app/admin/(protected)/expired-listings/[key]',
  'app/admin/(protected)/expired-outreach',
  'app/admin/(protected)/expireds',
  'app/admin/(protected)/fsbos',
  'app/admin/(protected)/inbox',
  'app/admin/(protected)/operations',
  'app/admin/(protected)/performance',
  'app/admin/(protected)/photos',
  // The R7 recorded-document review queue (2026-08-26). BARE DIR: page.tsx and
  // actions.ts are the whole route, both born on the v2 language, so a new file
  // under it is covered the day it lands.
  'app/admin/(protected)/place-documents',
  'app/admin/(protected)/query-builder',
  'app/admin/(protected)/resort-communities',
  'app/admin/(protected)/search',
  'app/admin/(protected)/spark-status',
  'app/admin/(protected)/stock-photos',
  'app/admin/(protected)/transactions',

  // File form: the route has a nested page or a sibling still carrying debt.

  'app/admin/(protected)/crm/[id]/page.tsx',
  'app/admin/(protected)/crm/sequences/page.tsx',
  'app/admin/(protected)/deals/page.tsx',
  'app/admin/(protected)/email/page.tsx',
  'app/admin/(protected)/expired-listings/page.tsx',
  'app/admin/(protected)/page.tsx',
  'app/admin/(protected)/visitors/page.tsx',

  // Zero-blocker pages under the content-based rule 3: every component in their
  // render closure is already scanned, so they are proven, not assumed.
  'app/admin/(protected)/content-library/page.tsx',
  'app/admin/(protected)/crm/deals/page.tsx',

  // Unblocked 2026-08-09 by migrating the 9 files these pages reached into:
  // EmailBodyEditor + MergeFieldInserter (the G50 composer chokepoints, taken
  // off shadcn IN PLACE — nothing moved and ci:composer-discipline is untouched),
  // GlobalActivityFeed.client, and the six newsletters ROUTE-ROOT forms that no
  // relocation-driven unit could see.
  'components/admin/crm/EmailBodyEditor.tsx',
  'components/admin/crm/MergeFieldInserter.tsx',
  'components/admin/crm/GlobalActivityFeed.client.tsx',
  'app/admin/(protected)/newsletters/SubscriberForms.tsx',
  'app/admin/(protected)/newsletters/BulkEnrollForm.tsx',
  'app/admin/(protected)/newsletters/NewsletterComposeForm.tsx',
  'app/admin/(protected)/newsletters/NewsletterDraftActions.tsx',
  'app/admin/(protected)/newsletters/BulkOneOffForm.tsx',
  'app/admin/(protected)/newsletters/GenerateDraftButton.tsx',
  'app/admin/(protected)/crm/activity/page.tsx',
  'app/admin/(protected)/newsletters/subscribers/page.tsx',
  'app/admin/(protected)/newsletters/[id]/page.tsx',
  'app/admin/(protected)/bpo/page.tsx',
  'app/admin/(protected)/cmas/page.tsx',
  'app/admin/(protected)/dscr/page.tsx',

  // ── 11F COMPLETE (2026-08-09) ─────────────────────────────────────────
  // The final wave: 98 files migrated so the last eight admin pages could gate.
  // Nothing was relocated to get here — rule 3 judges an import by whether the
  // target is scanned, so these were all migrated IN PLACE, including the G50
  // composer chokepoints.

  'app/admin/(protected)/crm/[id]/form-actions.ts',
  'app/admin/(protected)/crm/[id]/person-view-model.ts',
  'app/admin/(protected)/crm/_components/ContactsSearch.tsx',
  'app/admin/(protected)/crm/inbox/_components/InlineReply.tsx',
  'app/admin/(protected)/crm/inbox/_components/mobile/MobileComposeSheet.tsx',
  'app/admin/(protected)/crm/inbox/_components/mobile/MobileThread.tsx',
  'app/admin/(protected)/prospecting/[kind]/[id]/_components/ProspectDetailPage.client.tsx',
  'app/admin/(protected)/settings/MobileSettingsScreen.tsx',
  'app/admin/(protected)/settings/MySettingsForm.tsx',
  'components/admin/crm/BulkActions.tsx',
  'components/admin/crm/BulkProgress.tsx',
  'components/admin/crm/CmaKickoffMount.tsx',
  'components/admin/crm/CmaKickoffSheet.tsx',
  'components/admin/crm/CmaTextMeButton.tsx',
  'components/admin/crm/ComposeSurface.tsx',
  'components/admin/crm/ComposerAttachments.tsx',
  'components/admin/crm/ContactBehaviorPanel.tsx',
  'components/admin/crm/ContactBpoCard.tsx',
  'components/admin/crm/CmaComposeAttach.tsx',
  'components/admin/crm/ContactCmaCard.tsx',
  'components/admin/crm/ContactDeliveryPanel.tsx',
  'components/admin/crm/ContactEmailEngagement.tsx',
  'components/admin/crm/ContactListingAlertsPanel.tsx',
  'components/admin/crm/ContactNewsletterHistory.tsx',
  'components/admin/crm/ContactProspectHistoryCard.tsx',
  'components/admin/crm/ContactQuickActions.tsx',
  'components/admin/crm/ContactSendCenter.tsx',
  'components/admin/crm/ConversationFeed.tsx',
  'components/admin/crm/CustomFieldEditor.tsx',
  'components/admin/crm/CustomFieldsPanel.tsx',
  'components/admin/crm/EmailComposer.tsx',
  'components/admin/crm/MergeContactDialog.tsx',
  'components/admin/crm/OwnedHomeCard.tsx',
  'components/admin/crm/OwnedHomeMap.client.tsx',
  'components/admin/crm/RecipientField.tsx',
  'components/admin/crm/ReportSubscriptionsPanel.tsx',
  'components/admin/crm/SaveAsTemplateDialog.tsx',
  'components/admin/crm/SmsComposer.tsx',
  'components/admin/crm/StoredAttachments.tsx',
  'components/admin/crm/TemplatePicker.tsx',
  'components/admin/crm/TemplatePickerNav.tsx',
  'components/admin/crm/ViewedHomeCard.tsx',
  'components/admin/crm/ai-email-draft.ts',
  'components/admin/crm/bulk/FormSelect.tsx',
  'components/admin/crm/bulk/BatchRecipients.tsx',
  'components/admin/crm/bulk/EmailSendOptions.tsx',
  'components/admin/crm/bulk/TagCombo.tsx',
  'components/admin/crm/bulk/registry.tsx',
  'components/admin/crm/bulk/types.ts',
  'components/admin/crm/calendar/AppointmentModal.tsx',
  'components/admin/crm/calendar/AppointmentSheet.tsx',
  'components/admin/crm/calendar/CalendarGrids.tsx',
  'components/admin/crm/calendar/CalendarView.tsx',
  'components/admin/crm/calendar/mobile/MobileCalendarRows.tsx',
  'components/admin/crm/calendar/mobile/MobileCalendarScreen.tsx',
  'components/admin/crm/calendar/mobile/MobileMonthGrid.tsx',
  'components/admin/crm/cma-kickoff-client.ts',
  'components/admin/crm/composer-preload.ts',
  'components/admin/crm/composer-submit-guard.ts',
  'components/admin/crm/criteria/AlertCriteriaEditor.tsx',
  'components/admin/crm/criteria/ReportCriteriaEditor.tsx',
  'components/admin/crm/criteria/criteria-sentence.ts',
  'components/admin/crm/criteria/index.ts',
  'components/admin/crm/person-detail/InlineEditField.tsx',
  'components/admin/crm/person-detail/MobileLeadDetail.tsx',
  'components/admin/crm/person-detail/PersonCenterColumn.tsx',
  'components/admin/crm/person-detail/PersonDialogs.tsx',
  'components/admin/crm/person-detail/PersonEngagementRegion.tsx',
  'components/admin/crm/person-detail/PersonHomesRegion.tsx',
  'components/admin/crm/person-detail/PersonMobileCalendarRegion.tsx',
  'components/admin/crm/person-detail/PersonMobileHomesRegion.tsx',
  'components/admin/crm/person-detail/PersonRegionSkeleton.tsx',
  'components/admin/crm/person-detail/PersonRightRail.tsx',
  'components/admin/crm/person-detail/PersonSidebar.tsx',
  'components/admin/crm/person-detail/PersonWorkspace.tsx',
  'components/admin/crm/person-detail/PersonWorkspaceBody.tsx',
  'components/admin/crm/person-detail/PersonWorkspaceSkeleton.tsx',
  'components/admin/crm/portal-view/ClientPortalReadOnlyView.tsx',
  'components/admin/crm/portal-view/PortalFilterChips.tsx',
  'components/admin/crm/portal-view/PortalViewLink.tsx',
  'components/admin/crm/subscriptions/AlertEditDialog.tsx',
  'components/admin/crm/subscriptions/AlertEngineSettingsDialog.tsx',
  'components/admin/crm/subscriptions/AlertSubscriptionsTab.tsx',
  'components/admin/crm/subscriptions/ApprovalQueueTab.tsx',
  'components/admin/crm/subscriptions/AssignBrokerDialog.tsx',
  'components/admin/crm/subscriptions/DeliveryTab.tsx',
  'components/admin/crm/subscriptions/EmailPreviewDialog.tsx',
  'components/admin/crm/subscriptions/ReportEditDialog.tsx',
  'components/admin/crm/subscriptions/ReportSubscriptionsTab.tsx',
  'components/admin/crm/subscriptions/SubscriptionsHub.tsx',
  'components/admin/crm/subscriptions/delivery-shared.tsx',
  'components/admin/crm/subscriptions/subscriptions-shared.tsx',
  'components/admin/crm/viewed-home-bpo.ts',
  'components/admin/prospecting/ProspectComplianceRibbon.client.tsx',
  'components/admin/prospecting/ProspectDetailPanel.client.tsx',
  'components/admin/prospecting/ProspectDocPill.client.tsx',
  'components/admin/prospecting/ProspectMap.client.tsx',
  'components/admin/prospecting/ProspectPriceHistory.client.tsx',
  'components/admin/prospecting/ProspectSendDialog.client.tsx',
  'components/admin/prospecting/format.ts',
  'components/admin/push/BrokerPushOptIn.tsx',
  'components/admin/shared/mobile/MobileCalendarTab.tsx',
  'components/admin/shared/mobile/MobileCommsTab.tsx',
  'components/admin/shared/people-list/PeopleListView.tsx',

  // …and the eight pages themselves.

  'app/admin/(protected)/crm/calendar/page.tsx',
  'app/admin/(protected)/crm/inbox/page.tsx',
  'app/admin/(protected)/crm/page.tsx',
  'app/admin/(protected)/crm/subscriptions/page.tsx',
  'app/admin/(protected)/people/[id]/portal/page.tsx',
  'app/admin/(protected)/people/[id]/tools/page.tsx',
  'app/admin/(protected)/prospecting/[kind]/[id]/page.tsx',
  'app/admin/(protected)/settings/account/page.tsx',

  // ── 11F: the route-local islands (2026-08-09) ─────────────────────────
  // Rule 3 now resolves RELATIVE specifiers, which is what finally made these
  // visible: a page in scope importing './_components/X' was never checked, so
  // 59 islands rendered shadcn behind a page the gate called clean. That is the
  // 'green for the wrong reason' failure this phase exists to prevent, found by
  // asking what the rule could NOT see rather than trusting that it passed.

  'app/admin/(protected)/analytics/_components/DateRangePicker.tsx',
  'app/admin/(protected)/analytics/_components/ReportCatalog.tsx',
  'app/admin/(protected)/analytics/_components/SalesFunnelTab.tsx',
  'app/admin/(protected)/analytics/_components/charts.tsx',
  'app/admin/(protected)/analytics/_components/v2/DataGrid.tsx',
  'app/admin/(protected)/analytics/_components/v2/FunnelAudienceControl.tsx',
  'app/admin/(protected)/analytics/_components/v2/RangeControl.tsx',
  'app/admin/(protected)/analytics/_components/v2/VariantControl.tsx',
  'app/admin/(protected)/analytics/_components/v2/kit.tsx',
  'app/admin/(protected)/approval-queue/_components/ActionCard.tsx',
  'app/admin/(protected)/approval-queue/_components/BulkSelection.tsx',
  'app/admin/(protected)/approval-queue/_components/FilterSidebar.tsx',
  'app/admin/(protected)/bpo/_components/worklist/BpoSendDialog.client.tsx',
  'app/admin/(protected)/cmas/_components/worklist/CmaSendDialog.client.tsx',
  'app/admin/(protected)/crm/settings/_components/templates/EmailTemplateModal.tsx',
  'app/admin/(protected)/crm/settings/_components/templates/TextTemplateModal.tsx',
  'app/admin/(protected)/crm/settings/appointments/AppointmentSettingsClient.tsx',
  'app/admin/(protected)/crm/settings/market-reports/BulkSendForm.tsx',
  'app/admin/(protected)/crm/settings/team/TeamAccess.tsx',
  'app/admin/(protected)/deals/[key]/DealStageControls.tsx',
  'app/admin/(protected)/deals/[key]/ListingFileActions.tsx',
  'app/admin/(protected)/deals/[key]/DealOffers.tsx',
  'app/admin/(protected)/deals/[key]/ChecklistControls.tsx',
  'app/admin/(protected)/deals/[key]/CommissionControls.tsx',
  'app/admin/(protected)/deals/[key]/DealContacts.tsx',
  'app/admin/(protected)/deals/[key]/DealParties.tsx',
  'app/admin/(protected)/deals/[key]/DealEnvelopes.tsx',
  'app/admin/(protected)/deals/[key]/DealTasks.tsx',
  'app/admin/(protected)/deals/[key]/AddMissingChecklist.tsx',
  'app/admin/(protected)/deals/[key]/DealPropertyFacts.tsx',
  'app/admin/(protected)/deals/[key]/DealContingencyDays.tsx',
  'app/admin/(protected)/deals/[key]/DealPrices.tsx',
  'app/admin/(protected)/deals/[key]/DocumentName.tsx',
  'app/admin/(protected)/deals/[key]/DocumentRowActions.tsx',
  'app/admin/(protected)/deals/[key]/DocumentUpload.tsx',
  'app/admin/(protected)/deals/[key]/FillOrefPacket.tsx',
  'app/admin/(protected)/deals/[key]/CdaButton.tsx',
  'app/admin/(protected)/deals/[key]/BuyerAgreementWizard.tsx',
  'app/admin/(protected)/dscr/_components/DscrEmailDialog.client.tsx',
  'app/admin/(protected)/email/compose/_components/AdminEmailCompose.tsx',
  'app/admin/(protected)/email/compose/_components/ComposeToCohort.tsx',
  'app/admin/(protected)/financials/ExpenseControls.tsx',
  'app/admin/(protected)/financials/ExpenseLedger.tsx',
  'app/admin/(protected)/geo/AssignCommunity.tsx',
  'app/admin/(protected)/geo/EnsureGeoButton.tsx',
  'app/admin/(protected)/geo/NeighborhoodForm.tsx',
  'app/admin/(protected)/geo/area-guide-upload/AreaGuideUploadClient.tsx',
  'app/admin/(protected)/geo/resort-communities/ResortCommunityToggle.tsx',
  'app/admin/(protected)/geo/resort-communities/SeedResortButton.tsx',
  'app/admin/(protected)/listings/ListingsCsvExport.tsx',
  'app/admin/(protected)/listings/[listingKey]/AdminListingEditor.tsx',
  'app/admin/(protected)/media/AdminMediaManager.tsx',
  'app/admin/(protected)/media/banners/GenerateBannersButton.tsx',
  'app/admin/(protected)/media/photos/PhotoCurationBoard.tsx',
  'app/admin/(protected)/media/stock-photos/StockPhotosPicker.tsx',
  'app/admin/(protected)/newsletters/analytics/BrokerFilterSelect.tsx',
  'app/admin/(protected)/newsletters/enroll/EnrollClient.tsx',
  'app/admin/(protected)/people/[id]/CommsSection.tsx',
  'app/admin/(protected)/people/[id]/SendSection.tsx',
  'app/admin/(protected)/reports/custom/CustomReportBuilder.tsx',
  'app/admin/(protected)/reports/custom/ReportTimeSeriesChart.tsx',
  'app/admin/(protected)/reports/emails/EmailLogCsvButton.tsx',
  'app/admin/(protected)/sign-off/SignOffControls.tsx',
  'app/admin/(protected)/site-pages/HeroMediaForm.tsx',
  'app/admin/(protected)/site-pages/SiteLogoForm.tsx',
  'app/admin/(protected)/site-pages/SitePagesList.tsx',
  'app/admin/(protected)/site-pages/TeamImageForm.tsx',
  'app/admin/(protected)/sync/BackfillHealthPanel.tsx',
  'app/admin/(protected)/sync/SyncHeavyStatusSections.tsx',
  'app/admin/(protected)/sync/SyncLiveStatusAndTerminal.tsx',

  'app/admin/(protected)/analytics/_components/CityReportSection.tsx',
  'app/admin/(protected)/analytics/_components/GenerateReportButton.tsx',
  'app/admin/(protected)/approval-queue/_components/ActionButtons.tsx',
  'app/admin/(protected)/approval-queue/_components/CommentsThread.tsx',
  'app/admin/(protected)/approval-queue/_components/MediaPreview.tsx',
  'app/admin/(protected)/site-pages/SitePageEditor.tsx',
  'app/admin/(protected)/sync/SyncPageAdvanced.tsx',

  'app/admin/(protected)/sync/RefreshActivePendingButton.tsx',
  'app/admin/(protected)/sync/SyncHistoryButtons.tsx',
  'app/admin/(protected)/sync/SyncSinceDateButton.tsx',
  'app/admin/(protected)/sync/SyncSmart.tsx',
  'app/admin/(protected)/sync/TriggerDeltaSyncButton.tsx',
]
const EXT = new Set(['.ts', '.tsx', '.css'])

const failures = []

// Rule 1 — parity
if (!existsSync(SPEC)) failures.push(`missing locked spec: ${relative(ROOT, SPEC)}`)
if (!existsSync(COPY)) failures.push(`missing runtime copy: ${relative(ROOT, COPY)}`)
if (existsSync(SPEC) && existsSync(COPY)) {
  if (readFileSync(SPEC, 'utf8') !== readFileSync(COPY, 'utf8')) {
    failures.push(
      `tokens drift: components/admin/v2/tokens.css != design_system/admin/tokens.css ` +
        `(the locked spec wins — edit design_system first, then cp to components/admin/v2)`,
    )
  }
}

// Rules 2 + 3 — scan
// `#add-person` is a URL hash, not a color. `#add` is valid 3-digit hex, so
// `\b` after three hex digits was a false positive on hyphenated fragments.
const HEX = /#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z-])/g
const COLOR_FN = /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\s*\(/g
const TW_PALETTE =
  /\b(?:bg|text|border|from|to|via)-(?:white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{1,3})?(?:\/\d{1,3})?\b/g
const BRAND_LEAK = /--rr-|Amboqia|AmboqiaBoriango|\bGeist\b/g
// `shared` joins `v2` as a sanctioned import source (Matt 2026-08-08, 11F

// Rule 2b — SHADCN SEMANTIC CLASSES. These carry no palette name, so TW_PALETTE
// never saw them, and they were the blind spot this phase kept falling into: a
// file could pass every rule while rendering bg-card and text-muted-foreground,
// which resolve to the PUBLIC brand palette the admin's §5 amnesia blacklists.
// It is what forced newsletters to be un-gated in unit 10, what made the 27
// shared/ files need hand-verification, and what left 17 route-root files
// invisible. Turned on 2026-08-09 at ZERO cost: measured 0 occurrences across
// all 250 files already in scope, so "scanned by this gate" now means what it
// always claimed to mean.
const SEMANTIC_CLASS =
  /\b(?:bg-card|bg-background|bg-muted|bg-accent|bg-secondary|bg-popover|text-foreground|text-muted-foreground|text-primary|bg-primary|text-primary-foreground|text-secondary-foreground|text-accent-foreground|text-destructive|bg-destructive|text-card-foreground|border-border|border-input|divide-border|ring-ring)\b/g
// blocker decision 1). components/admin/shared holds the CRM machinery that
// more than one route mounts — infrastructure, not one route's islands — and it
// is held to these same token rules rather than exempted from them: its files
// are listed in SCAN_DIRS below. Two directories with one rule each, instead of
// one directory with two jobs; the rejected alternative was per-page holes in
// this blacklist.
// Rule 3 — IMPORTS, judged by whether the TARGET IS ITSELF SCANNED by this gate
// (isScanned below), not by where it happens to live.
//
// This was a location allowlist: components/admin/v2, and later
// components/admin/shared. That was the right proxy when v2 was the only clean
// directory and the wrong one afterwards — it asks WHERE a file sits when the
// rule means "does this render public-brand colour". The cost was concrete: it
// would have forced BulkActions, ConversationFeed and AppointmentSheet (one,
// two and two importers) to be relocated into a directory explicitly defined as
// MULTI-ROUTE infrastructure purely to satisfy a path check, dragging the G50
// composer chokepoints along with them.
//
// SCAN_DIRS membership is SELF-PROVING: a file added there carrying raw colour,
// a palette class, a semantic class, a brand leak or its own illegal import
// makes this gate FAIL. You cannot open a hole by adding to the list, which is
// what separates this from the per-page exemptions Matt rejected (decisions.md,
// 11F blocker 1). One rule, no per-case entries.
// Scoped to the SAME universe the location rule policed — components/admin/*
// and components/ui/*. Shared app components outside that (GoogleMapsBootstrap,
// ShareButton, icons/*, tc/*) were never in scope and are not now: widening the
// rule to them would be a different, unreviewed decision.
const COMPONENT_IMPORT = /from\s+['"]((?:@\/)?components\/(?:admin|ui)\/[^'"]+)['"]/g
// RELATIVE imports count too. The rule above only matches a `components/...`
// specifier, so a route-local island imported as './_components/ActionCard' was
// invisible — 67 such files were reachable from a scanned page while carrying
// shadcn, which is precisely the "gated but still renders the public brand"
// failure this phase exists to prevent. Only .tsx targets are required to be
// scanned: a .ts module has no JSX and cannot paint anything.
const RELATIVE_IMPORT = /from\s+['"](\.[^'"]*)['"]/g

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (EXT.has(entry.name.slice(entry.name.lastIndexOf('.')))) out.push(full)
  }
  return out
}

function report(file, lineIdx, rule, snippet) {
  failures.push(`${relative(ROOT, file)}:${lineIdx + 1} — ${rule}: ${snippet.trim().slice(0, 90)}`)
}

// The set of files this gate actually inspects, resolved once. Rule 3 asks
// membership of this set, so "legal to import" and "proven clean" are the same
// statement rather than two lists that can drift apart.
const SCANNED = new Set()
for (const entry of SCAN_DIRS) {
  const abs = join(ROOT, entry)
  if (!existsSync(abs)) continue
  if (statSync(abs).isDirectory()) for (const f of walk(abs)) SCANNED.add(f)
  else SCANNED.add(abs)
}

/**
 * Resolve a RELATIVE specifier against the importing file. Returns null unless
 * the target is a .tsx under app/admin or components — a .ts helper renders
 * nothing, and anything outside those trees is not this gate's business.
 */
function resolveRelativeImport(spec, fromFile) {
  const base = join(dirname(fromFile), spec)
  for (const ext of ['.tsx', '/index.tsx', '']) {
    const p = base + ext
    if (existsSync(p) && statSync(p).isFile() && p.endsWith('.tsx')) {
      const rel = relative(ROOT, p)
      if (rel.startsWith('app/admin/') || rel.startsWith('components/')) return p
      return null
    }
  }
  return null
}

/** Resolve a `components/...` or `@/components/...` specifier to a real file. */
function resolveComponentImport(spec) {
  const rel = spec.startsWith('@/') ? spec.slice(2) : spec
  const base = join(ROOT, rel)
  for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const p = base + ext
    if (existsSync(p) && statSync(p).isFile()) return p
  }
  return null
}

for (const dir of SCAN_DIRS) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) {
    failures.push(`SCAN_DIRS entry missing on disk: ${dir}`)
    continue
  }
  const files = statSync(abs).isDirectory() ? walk(abs) : [abs]
  for (const file of files) {
    const isTokens = file === COPY
    const lines = readFileSync(file, 'utf8').split('\n')
    // COMMENTS ARE NOT CODE. These rules are regexes over raw lines, so a
    // comment EXPLAINING a colour decision — "paired with --a-btn-fg, #FFFFFF
    // in light", "an earlier fix reached for color-mix()", "instead of a
    // hardcoded text-white" — tripped the very rule it was documenting. That
    // punishes the one thing this codebase wants most from a migration: a
    // written reason. Third occurrence of the class (ci:admin-ui rule D and
    // ci:server-type-reexport both matched their own worked examples and were
    // rewritten AST-based); this gate stays line-based but skips comment text.
    //
    // Deliberately conservative: only whole-line comments and block-comment
    // interiors are skipped. A trailing comment after real code still counts,
    // because the code on that line is code.
    let inBlockComment = false
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      const wasInBlock = inBlockComment
      if (inBlockComment) {
        if (trimmed.includes('*/')) inBlockComment = false
      } else if (
        (trimmed.startsWith('/*') || trimmed.startsWith('{/*')) &&
        !trimmed.includes('*/')
      ) {
        // {/* … */} spans lines in JSX and its continuation lines start with
        // ordinary prose, so without this the closing line of a multi-line JSX
        // comment is read as code.
        inBlockComment = true
      }
      const isCommentLine =
        wasInBlock ||
        inBlockComment ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*')
      if (isCommentLine) return

      if (!isTokens) {
        if (HEX.test(line)) report(file, i, 'raw hex (use var(--a-*))', line)
        HEX.lastIndex = 0
        if (COLOR_FN.test(line)) report(file, i, 'color function literal (use var(--a-*))', line)
        COLOR_FN.lastIndex = 0
        if (TW_PALETTE.test(line)) report(file, i, 'Tailwind palette class (admin v2 does not use Tailwind color)', line)
        TW_PALETTE.lastIndex = 0
        if (SEMANTIC_CLASS.test(line)) report(file, i, 'shadcn semantic class (resolves to the PUBLIC brand palette — use var(--a-*))', line)
        SEMANTIC_CLASS.lastIndex = 0
      }
      if (BRAND_LEAK.test(line)) report(file, i, 'public-brand leak (amnesia: no --rr-*/Amboqia/Geist in admin v2)', line)
      BRAND_LEAK.lastIndex = 0
      // Rule 3 — the imported module must itself be in scope for this gate.
      const rule3 = [
        ...[...line.matchAll(COMPONENT_IMPORT)].map((m) => resolveComponentImport(m[1])),
        ...[...line.matchAll(RELATIVE_IMPORT)].map((m) => resolveRelativeImport(m[1], file)),
      ]
      for (const target of rule3) {
        // Unresolvable (a type-only path alias, a barrel that does not exist on
        // disk) is not evidence of a violation — do not guess.
        if (!target) continue
        if (!SCANNED.has(target)) {
          report(
            file,
            i,
            `imports ${relative(ROOT, target)}, which this gate does not scan — ` +
              'migrate it and add it to SCAN_DIRS, or do not import it here',
            line,
          )
        }
      }
      // Rule 4 — chrome ban (ADMIN_UI §3 acceptance bar, Matt 2026-08-05):
      // filter sets are ONE compact control, never pill rows.
      if (line.includes('av2-chiprow')) {
        report(file, i, 'chip wall (acceptance bar #2: filters are one dropdown, not pill rows)', line)
      }
    })
  }
}

if (failures.length) {
  console.error('✗ admin-v2 token gate failed:')
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log('✓ admin-v2 tokens: runtime copy matches the locked spec; no raw color, no brand leak.')
