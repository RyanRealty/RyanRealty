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
const peopleLoading = read('app/admin/(protected)/people/loading.tsx')
const peopleError = read('app/admin/(protected)/people/error.tsx')
const listView = read('components/admin/shared/people-list/PeopleListView.tsx')
const addDialog = read('components/admin/shared/people-list/AddPersonDialog.tsx')
const crmNew = read('app/admin/(protected)/crm/new/page.tsx')
const crmPage = read('app/admin/(protected)/crm/page.tsx')
const listAction = read('app/actions/crm.ts')
const savedViews = read('lib/data/crm/getCrmSavedViews.ts')
const personPage = read('app/admin/(protected)/people/[id]/page.tsx')
const personLoading = read('app/admin/(protected)/people/[id]/loading.tsx')
const createContact = read('lib/crm/create-contact.ts')
const persistCreated = read('lib/crm/persist-created-contact.ts')
const crmLoading = read('app/admin/(protected)/crm/loading.tsx')
const fab = read('components/console/ConsoleQuickAction.tsx')

if (!/AddPersonCard/.test(peoplePage)) {
  fails.push('app/admin/(protected)/people/page.tsx must mount AddPersonCard as the primary New contact path')
}
if (!/AddPersonCard/.test(crmPage)) {
  fails.push('/admin/crm must mount AddPersonCard on first paint, not a New contact link that leaves the page')
}
if (/href="\/admin\/people\?add=1"/.test(crmPage) || /href="\/admin\/crm\/new"/.test(crmPage)) {
  fails.push('/admin/crm must not send New contact through a second page or Quick actions')
}
if (!/AddPersonCard/.test(crmLoading)) {
  fails.push('/admin/crm loading must paint AddPersonCard so the list hang never hides add')
}
if (!/href="#add-person"/.test(fab) || !/addPersonSurface/.test(fab)) {
  fails.push('People/CRM FAB must jump to #add-person, not open Quick actions')
}
if (!/\/admin\/crm#add-person/.test(fab)) {
  fails.push('Quick actions New contact must land on /admin/crm#add-person')
}
if (!/id="add-person"/.test(peopleLoading) || !/New contact/.test(peopleLoading)) {
  fails.push('app/admin/(protected)/people/loading.tsx must paint New contact chrome (no blank white page)')
}
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
if (!/name="street"/.test(crmNew) || !/name="city"/.test(crmNew) || !/name="zip"/.test(crmNew)) {
  fails.push('/admin/crm/new must collect structured address fields')
}
if (/name="note"/.test(crmNew) || /label="Note"/.test(crmNew)) {
  fails.push('/admin/crm/new must not have a Note field')
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
if (!/getPersonGlance/.test(personPage) || !/nextLine/.test(personPage) || !/nowLine/.test(personPage)) {
  fails.push('person detail must first-paint Next and Now from getPersonGlance')
}
if (!/savePersonNoteAction/.test(read('app/admin/(protected)/people/[id]/PersonNotesAdd.tsx'))) {
  fails.push('person notes must save through savePersonNoteAction, not a hanging form post')
}
const relUi = read('app/admin/(protected)/people/[id]/PersonRelationships.tsx')
const relAction = read('app/actions/crm-relationships.ts')
if (!/useState\(true\)/.test(relUi)) {
  fails.push('Related people add form must be open on first paint')
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
