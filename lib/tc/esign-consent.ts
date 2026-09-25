/**
 * The consumer disclosure a signer agrees to before signing electronically:
 * the notices the federal ESIGN Act (15 U.S.C. 7001(c)) requires before a
 * consumer consents to electronic records (the right to paper, how to
 * withdraw, what the consent covers, how to update contact details, what is
 * needed to open and keep the records), and Oregon's UETA (ORS 84.001 to
 * 84.061). The version is stored with the consent, so the record shows which
 * words were agreed to. Change the text, change the version. Pure.
 */
import { CONTACT } from '@/lib/brand/contact'

export const ESIGN_CONSENT_VERSION = 'esign-consent-v2-2026-09-24'

export const ESIGN_CONSENT_SUMMARY =
  'I agree to use electronic records and signatures for this transaction, and I understand my electronic signature is legally binding under the ESIGN Act and Oregon law.'

export function esignDisclosure(): Array<{ heading: string; text: string }> {
  return [
    {
      heading: 'What you are agreeing to',
      text: 'Ryan Realty will give you the documents for this transaction electronically, and you may sign them electronically. Your electronic signature has the same legal effect as a signature on paper. This consent covers the documents in this signing request.',
    },
    {
      heading: 'You can have paper',
      text: `You may ask for a paper copy of any document at no charge. Call ${CONTACT.phoneDirect} or reply to the email that sent you here.`,
    },
    {
      heading: 'You can change your mind',
      text: `You may withdraw this consent before you finish signing by choosing Decline, or by calling ${CONTACT.phoneDirect}. Withdrawing does not undo anything you signed before, and we will then complete the transaction on paper.`,
    },
    {
      heading: 'Keep your contact details current',
      text: 'Tell your broker if your email address changes, so the completed copy reaches you.',
    },
    {
      heading: 'What you need',
      text: 'A current web browser on a phone or computer, an email account, and a way to open, save or print PDF files. When everyone has signed, a completed copy is emailed to you.',
    },
  ]
}
