#!/usr/bin/env node
/**
 * check-crm-add-person.mjs (ci:crm-add-person)
 *
 * Brokers add households from People. This class failed when:
 *   - /admin/people had no loading UI (blank white while the read ran)
 *   - New contact was an icon, New List was the labeled button
 *   - /admin/crm blocked first paint on book-wide exact COUNT(*)s
 *   - address was dumped into a note because create had no street/city/state/zip
 *   - person detail hung on skeleton waiting for the workspace fold
 */
import { readFileSync, existsSync } from 'node:fs'

const fails = []

function read(path) {
  if (!existsSync(path)) {
    fails.push(`missing ${path}`)
    return ''
  }
  return readFileSync(path, 'utf8')
}

const peoplePage = read('app/admin/(protected)/people/page.tsx')
const peopleError = read('app/admin/(protected)/people/error.tsx')
const listView = read('components/admin/shared/people-list/PeopleListView.tsx')
const addDialog = read('components/admin/shared/people-list/AddPersonDialog.tsx')
const crmPage = read('app/admin/(protected)/crm/page.tsx')
const listAction = read('app/actions/crm.ts')
const savedViews = read('lib/data/crm/getCrmSavedViews.ts')
const personPage = read('app/admin/(protected)/people/[id]/page.tsx')
const personLoading = read('app/admin/(protected)/people/[id]/loading.tsx')
const createContact = read('lib/crm/create-contact.ts')
const persistCreated = read('lib/crm/persist-created-contact.ts')
const crmLoading = read('app/admin/(protected)/crm/loading.tsx')
const fab = read('components/console/ConsoleQuickAction.tsx')

// Collapsed on first paint (Matt 2026-09-01, reversing the always-visible-card
// rule): the list surface leads with search; the add form lives in
// AddPersonDialog behind ONE labeled opener. Same reversal shape as Related
// people (Matt 2026-08-25). What still has to be true: New contact is one
// click away on every door, and the #add-person deep link opens the dialog.
// People-list fold (Matt lock 2026-09-01, decisions.md): /admin/people (list
// route only) is a pure bridge to /admin/crm — one list surface.
if (!/redirect\(/.test(peoplePage) || !/\/admin\/crm/.test(peoplePage) || /AddPersonCard|NewContactButton/.test(peoplePage)) {
  fails.push('app/admin/(protected)/people/page.tsx must be a pure redirect bridge to /admin/crm (the one list surface)')
}
if (/AddPersonCard/.test(crmPage)) {
  fails.push('/admin/crm must not mount an inline add form — PeopleListView\'s toolbar opens AddPersonDialog')
}
if (!/onClick=\{\(\) => setAddOpen\(true\)\}/.test(listView)) {
  fails.push('PeopleListView\'s New contact button must open AddPersonDialog directly')
}
if (/href="\/admin\/people\?add=1"/.test(crmPage) || /href="\/admin\/crm\/new"/.test(crmPage)) {
  fails.push('/admin/crm must not send New contact through a second page or Quick actions')
}
if (/AddPersonCard/.test(crmLoading)) {
  fails.push('/admin/crm loading must not paint the retired inline add form')
}
if (!/href="#add-person"/.test(fab) || !/addPersonSurface/.test(fab)) {
  fails.push('People/CRM FAB must jump to #add-person, not open Quick actions')
}
if (!/\/admin\/crm#add-person/.test(fab)) {
  fails.push('Quick actions New contact must land on /admin/crm#add-person')
}
if (!/#add-person/.test(listView)) {
  fails.push('PeopleListView must open AddPersonDialog when the URL carries #add-person (the FAB deep link)')
}
// people/loading.tsx deleted with the list fold — the redirect bridge paints
// nothing; /admin/crm/loading.tsx carries the skeleton duty for the survivor.
if (!/New contact/.test(peopleError)) {
  fails.push('app/admin/(protected)/people/error.tsx must keep New contact reachable after a load failure')
}
if (!/New contact/.test(listView)) {
  fails.push('PeopleListView must label the New contact button')
}
if (!/data-tour="crm-add-person"[\s\S]*New contact[\s\S]*New List/.test(listView)) {
  fails.push('PeopleListView must render the labeled New contact action before New List')
}
if (!/label="Street"/.test(addDialog) || !/label="City"/.test(addDialog) || !/label="Zip"/.test(addDialog)) {
  fails.push('AddPersonDialog must collect a structured street, city, state, zip address')
}
if (/label="Note"/.test(addDialog) || /label="Tags"/.test(addDialog)) {
  fails.push('AddPersonDialog must not collect a note or tags on quick add')
}
// /admin/crm/new deleted 2026-09-01 — it was an orphaned duplicate of
// AddPersonDialog with zero inbound links. The dialog is the one create path.
if (existsSync('app/admin/(protected)/crm/new/page.tsx')) {
  fails.push('/admin/crm/new must stay deleted — AddPersonDialog is the one create path')
}
// Quick add requires a name and ONE way to reach the person. Phone used to be
// mandatory, which made an email-only contact impossible to create in the UI
// even though the book holds tens of thousands of them and every web lead
// arrives that way. The structured-address build is unchanged and still gated.
if (
  !/createContactAddress/.test(createContact) ||
  !/Add an email, or a phone number/.test(createContact) ||
  !/First name required/.test(createContact)
) {
  fails.push('lib/crm/create-contact.ts must require a first name plus an email or a phone, and build a structured address')
}
if (!/input\.email\.trim\(\) \|\| input\.phone\.trim\(\)/.test(createContact)) {
  fails.push('canSubmitCreateContact must accept an email-only contact (email OR phone), never require both')
}
if (!/createContactAddress/.test(listAction) || !/persistCreatedContactAddress/.test(listAction)) {
  fails.push('createCrmContactAction must persist the structured address after create')
}
if (!/update\(\{ addresses:/.test(persistCreated) || !/crm_people/.test(persistCreated)) {
  fails.push('persistCreatedContactAddress must write crm_people.addresses')
}
if (/message: note/.test(listAction) || /Added manually in the CRM/.test(listAction)) {
  fails.push('createCrmContactAction must not write the address or a default line as a note')
}
if (!/includeCounts:\s*false/.test(crmPage)) {
  fails.push('/admin/crm must load saved views without per-list exact counts on first paint')
}
if (!/totalExact/.test(listAction) || !/includeCount/.test(listAction)) {
  fails.push('listCrmPeople must skip the book-wide exact COUNT(*) on the default list')
}
if (!/includeCounts/.test(savedViews)) {
  fails.push('getCrmSavedViews must accept includeCounts so first paint can skip live counts')
}
if (!/PersonWorkspace/.test(personPage) || !/Suspense/.test(personPage) || !/PersonAddressEditor/.test(personPage)) {
  fails.push('person detail must first-paint identity and address, then stream PersonWorkspace')
}
if (!/PersonRelationships/.test(personPage) || !/PersonNotesAdd/.test(personPage) || !/FieldEditors/.test(personPage) || !/getPersonNotes/.test(personPage)) {
  fails.push('person detail must first-paint stage, related people, and notes')
}

// ONE send surface. The page carried both a composer and a separate "Send"
// section whose entire body was a trigger button; the deliverable centre now
// mounts inside Messages. A second top-level Send section coming back is the
// regression this catches.
const workspace = read('app/admin/(protected)/people/[id]/PersonWorkspace.tsx')
const sendSection = read('app/admin/(protected)/people/[id]/SendSection.tsx')
if (/aria-label="Send"/.test(workspace) || /aria-label="Send"/.test(sendSection)) {
  fails.push('person detail must have ONE send surface — mount the deliverable centre inside Messages, not a second Send section')
}
if (!/<SendSection/.test(workspace)) {
  fails.push('person detail must still mount SendSection (the deliverable chokepoint) inside Messages')
}
if (!/getPersonGlance/.test(personPage) || !/nextLine/.test(personPage) || !/nowLine/.test(personPage)) {
  fails.push('person detail must first-paint Next and Now from getPersonGlance')
}
if (!/savePersonNoteAction/.test(read('app/admin/(protected)/people/[id]/PersonNotesAdd.tsx'))) {
  fails.push('person notes must save through savePersonNoteAction, not a hanging form post')
}
const relUi = read('app/admin/(protected)/people/[id]/PersonRelationships.tsx')
const relAction = read('app/actions/crm-relationships.ts')
// Closed on first paint (Matt 2026-08-25, reversing the 2026-08-05 lock). The
// open form put six relationship buttons and a search field on every contact
// page for a task that happens once per contact. What still has to be true is
// that adding a relationship is ONE click away and the empty state says so —
// a collapsed form that hides its own trigger would be the real regression.
if (/useState\(true\)/.test(relUi)) {
  fails.push('Related people add form must be CLOSED on first paint (useState(false))')
}
if (!/No relationships yet/.test(relUi) || !/setOpen\(true\)/.test(relUi)) {
  fails.push('Collapsed Related people must still show the empty state and a one-click Add trigger')
}
if (!/Search an existing person/.test(relUi) || !/SIMPLE_RELATIONSHIP_TYPES/.test(relUi) || !/saveHit/.test(relUi)) {
  fails.push('Relationships add must search an existing person and save on that click')
}
if (!/reciprocalType/.test(relAction) || !/crm_relationships/.test(relAction)) {
  fails.push('linkExistingRelationshipAction must write both relationship rows')
}
if (!/Opening this person/.test(personLoading)) {
  fails.push('people/[id]/loading.tsx must paint immediately so detail does not hang blank')
}

console.log('CRM new-contact primary path (ci:crm-add-person)')
console.log('===============================================')
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('OK — New contact is first-class, address is structured, detail streams.')
process.exit(0)
