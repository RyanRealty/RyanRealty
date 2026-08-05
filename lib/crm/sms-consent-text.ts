/**
 * The carrier-verified A2P/TCPA SMS consent sentence — ONE source of truth.
 *
 * Moved out of components/site/SmsConsentDisclosure.tsx (a 'use client'
 * module) 2026-08-05 so SERVER surfaces can reuse the exact wording: the CMA
 * registration door (app/api/cma/register + the /cma/[slug] consent shell)
 * must present the identical sentence the carriers vetted. The component
 * re-exports it, so every existing importer is unchanged.
 *
 * ci:sms-consent (scripts/check-sms-consent-compliance.mjs) locks this file's
 * sentence word-for-word AND verifies the component imports it — editing the
 * wording requires re-submitting the A2P campaign first.
 */
export const SMS_CONSENT_TEXT =
  'I agree to receive text messages from Ryan Realty about my request, including property and home-value updates, scheduling, and replies from our team, at the phone number I provided. Consent is not a condition of any purchase or service. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.'
