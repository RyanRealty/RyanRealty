#!/usr/bin/env node
/**
 * check-person-identity-edit.mjs (ci:person-identity-edit)
 *
 * /admin/people/:id must expose inline first/last name + lead type on both
 * the v2 header and the lead-page-v3 header, writing through one server
 * action that leaves a timeline audit note and never sends.
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

const plan = read('lib/crm/person-identity-edit.ts')
const tests = read('lib/crm/person-identity-edit.test.ts')
const action = read('app/actions/crm-person-identity.ts')
const wrapper = read('app/admin/(protected)/people/actions.ts')
const editor = read('components/admin/crm/PersonIdentityEditor.tsx')
const v2 = read('app/admin/(protected)/people/[id]/PersonIdentityHeader.tsx')
const v3 = read('components/admin/crm/lead-page-v3/LeadHeader.tsx')
const page = read('app/admin/(protected)/people/[id]/page.tsx')

if (!/planPersonIdentityEdit/.test(plan) || !/PERSON_LEAD_TYPES/.test(plan)) {
  fails.push('lib/crm/person-identity-edit.ts must plan name + buyer/seller/other')
}
if (!/Elize Marais/.test(tests) || !/Jane Doe/.test(tests) || !/seller/.test(tests)) {
  fails.push('lib/crm/person-identity-edit.test.ts must cover Elize, real-name overwrite, and seller')
}
if (!/updatePersonIdentityAction/.test(action) || !/crm_timeline/.test(action)) {
  fails.push('app/actions/crm-person-identity.ts must write the person and a timeline audit note')
}
if (/sendSms\s*\(|sendCrmEmail\s*\(/.test(action) || /sendSms\s*\(|sendCrmEmail\s*\(/.test(plan)) {
  fails.push('person identity edit must not send SMS or email')
}
if (!/updateIdentityFromPerson/.test(wrapper) || !/updatePersonIdentityAction/.test(wrapper)) {
  fails.push('people/actions.ts must wrap updatePersonIdentityAction')
}
if (!/First name/.test(editor) || !/Last name/.test(editor) || !/Lead type/.test(editor)) {
  fails.push('PersonIdentityEditor must expose first name, last name, and lead type')
}
if (!/PersonIdentityEditor/.test(v2)) {
  fails.push('PersonIdentityHeader (v2) must render PersonIdentityEditor')
}
if (!/PersonIdentityEditor/.test(v3)) {
  fails.push('LeadHeader (v3) must render PersonIdentityEditor')
}
if (!/updateIdentityFromPerson/.test(page)) {
  fails.push('people/[id]/page.tsx must wire updateIdentityFromPerson')
}

console.log('Person identity edit gate (ci:person-identity-edit)')
console.log('==================================================')
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('  ✓ v2 + v3 name/lead-type editors write through one audited action')
process.exit(0)
