/**
 * The fixed words /email-preferences shows after a choice. A result arrives
 * as a CODE in the URL (lib/crm/market-report-preferences.ts), and only a
 * code this file knows becomes words, so a crafted link can never put text on
 * our domain. Voice: marketing_brain_skills/brand-voice/VOICE.md, no em dashes
 * (ci:no-public-em-dash scans this folder).
 */
import type { V3QuietAlert } from '@/components/site/v3'
import type { ReportPreferencesView } from '@/lib/data/crm/reportPreferences'

export const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

export const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
] as const

/** What is true after a choice, worded from the page's current state. */
export function doneAlert(code: string, view: ReportPreferencesView): V3QuietAlert | null {
  const areas = view.areas.map((a) => a.label).join(', ')
  const every = view.frequency ? FREQUENCY_LABEL[view.frequency]?.toLowerCase() : null
  switch (code) {
    case 'on':
      return { title: 'Your market report is on', description: 'It comes on the schedule shown below.' }
    case 'paused':
      return { title: 'Your market report is paused', description: 'Nothing goes out until you resume it.' }
    case 'stopped':
      return {
        title: 'Your market report is stopped',
        description: 'No more market reports. Other email from Ryan Realty is not affected.',
      }
    case 'frequency':
      return every ? { title: 'Saved', description: `Your report comes ${every}.` } : null
    case 'areas':
      return areas ? { title: 'Saved', description: `Your report covers ${areas}.` } : null
    case 'all-email-off':
      return {
        title: 'All email from Ryan Realty is off',
        description: 'You will not get email from us at this address, market reports included.',
      }
    case 'all-email-on':
      return { title: 'Email from Ryan Realty is back on', description: 'Your settings below are what we will send.' }
    case 'preview':
      return { title: 'Broker preview', description: 'This is a preview link, so nothing changed.' }
    default:
      return null
  }
}

/** Why a choice did not land. */
export function errorAlert(code: string): V3QuietAlert | null {
  switch (code) {
    case 'save':
      return {
        title: 'That did not save',
        description: 'Try again. If it keeps happening, reply to any of our emails and we will take care of it.',
      }
    case 'last-area':
      return { title: 'Keep at least one area', description: 'To stop the report instead, use Stop these reports.' }
    case 'no-areas':
      return { title: 'Pick an area first', description: 'Add at least one area, then turn the report back on.' }
    case 'unknown-area':
      return { title: 'We do not report on that area', description: 'Pick one from the list.' }
    case 'restart-blocked':
      return {
        title: 'We cannot turn email back on from here',
        description:
          'Email to this address is off for a reason this page cannot clear. Reply to any of our emails and we will sort it out.',
      }
    case 'no-subscription':
      return { title: 'Nothing to change', description: 'You are not signed up for a regular market report.' }
    case 'input':
      return { title: 'Pick an option', description: 'Choose from the list, then press the button beside it.' }
    case 'changed':
      return {
        title: 'Your report changed while this page was open',
        description: 'Nothing was changed by that choice. Here is how your report stands now; make the choice again if you still want it.',
      }
    case 'stop-all-failed':
      return {
        title: 'Email is still on',
        description:
          'We could not save your request just now. Try again in a minute. If it still does not go through, reply to any of our emails and we will turn email off for you.',
      }
    case 'closed':
      return {
        title: 'Only stopping email is possible from this link',
        description: 'You can stop these reports or all email from Ryan Realty here. To get reports again, reply to any of our emails.',
      }
    default:
      return null
  }
}
