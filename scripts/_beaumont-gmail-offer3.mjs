#!/usr/bin/env node
/** Download the Nicoll Offer-3 agreement attachments from Matt's 5/14 forward. */
import { google } from 'googleapis'
import fs from 'node:fs/promises'
const MSG_ID = '19e27381599efe1c'   // Matt -> Tiffany+TC, 5/14, full offer-3 package
const USER = 'matt@ryan-realty.com'
const OUT = 'tmp/beaumont-offer3'
await fs.mkdir(OUT, { recursive: true })
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'], subject: USER,
})
await auth.authorize()
const gmail = google.gmail({ version: 'v1', auth })
const msg = await gmail.users.messages.get({ userId: 'me', id: MSG_ID, format: 'full' })
const found = []
;(function walk(p){ if(!p)return; if(p.filename&&p.body?.attachmentId) found.push({filename:p.filename,attId:p.body.attachmentId}); for(const s of p.parts||[])walk(s) })(msg.data.payload)
for (const f of found) {
  const att = await gmail.users.messages.attachments.get({ userId:'me', messageId:MSG_ID, id:f.attId })
  const buf = Buffer.from(att.data.data.replace(/-/g,'+').replace(/_/g,'/'),'base64')
  await fs.writeFile(`${OUT}/${f.filename.replace(/[\\/]/g,'_')}`, buf)
  console.log(`  ${f.filename} (${buf.length}b)`)
}
console.log('done ->', OUT)
