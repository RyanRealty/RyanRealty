#!/usr/bin/env node
/**
 * Download the "Lead based paint both signatures.pdf" attachment
 * from Travis Cannon's Oct 4, 2024 email in the "Offer 2 Hernandez" thread.
 *
 * Message ID: 1925893a7efb0505
 * Attachment ID: ANGjdJ-mqU4fg5kZ-fGt_9P3R0XV9iCLfqj_SkJk1Tch83LzSC6sdVyDhJyo9ZcUoIlAzgIvW1RUNnptBQoNJrrBEZ4rkRUo6aUmRJveeLjhh90tJGrwjHvf_FS44vbml0O8bol2TbKcU21zX1X5zy7gvpKMPD7oK9wg0NXyZ2DgmhAg6CmshBHPk5MxpDq-nlaLD0uvD_Tt7vd0dpys_29l1TYBlQNAmDoGDMsBN1O_tRQoQ7OeXdO50VAjOtj7f3M_Z7Tno5nu5TnB0xWdHzYFQc7MlO7Sxf8Cw0tebMusJQJmQ99j5xDaXBgaOeDkEsyHDfjhPfX7JjT1Vh3LTC_tXOqYCnaJrPMgdTSM1G6L86rvXpOZggSGbikdZMmQQrxU8o1e0dvZqx5Zd2_V
 * Inbox: matt@ryan-realty.com
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'

const INBOX = 'matt@ryan-realty.com'
const MSG_ID = '1925893a7efb0505'
const ATTACHMENT_ID = 'ANGjdJ-mqU4fg5kZ-fGt_9P3R0XV9iCLfqj_SkJk1Tch83LzSC6sdVyDhJyo9ZcUoIlAzgIvW1RUNnptBQoNJrrBEZ4rkRUo6aUmRJveeLjhh90tJGrwjHvf_FS44vbml0O8bol2TbKcU21zX1X5zy7gvpKMPD7oK9wg0NXyZ2DgmhAg6CmshBHPk5MxpDq-nlaLD0uvD_Tt7vd0dpys_29l1TYBlQNAmDoGDMsBN1O_tRQoQ7OeXdO50VAjOtj7f3M_Z7Tno5nu5TnB0xWdHzYFQc7MlO7Sxf8Cw0tebMusJQJmQ99j5xDaXBgaOeDkEsyHDfjhPfX7JjT1Vh3LTC_tXOqYCnaJrPMgdTSM1G6L86rvXpOZggSGbikdZMmQQrxU8o1e0dvZqx5Zd2_V'
const OUT_DIR = 'tmp/bear-st-phase0/gmail-hunt-lbp'
const OUT_FILE = `${OUT_DIR}/Lead-based-paint-both-signatures.pdf`

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  subject: INBOX,
})

await fs.mkdir(OUT_DIR, { recursive: true })

const gmail = google.gmail({ version: 'v1', auth })
console.log(`Fetching attachment from message ${MSG_ID}...`)

const res = await gmail.users.messages.attachments.get({
  userId: 'me',
  messageId: MSG_ID,
  id: ATTACHMENT_ID,
})

const data = res.data.data
// Gmail API returns URL-safe base64; convert to standard base64
const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
const buf = Buffer.from(base64, 'base64')

await fs.writeFile(OUT_FILE, buf)
console.log(`Saved ${buf.length} bytes to ${OUT_FILE}`)
