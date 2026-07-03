#!/usr/bin/env node
/** Stage remap RESTORE — writes each contact's pre-remap stage back from the backup. */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APPLY = process.argv.includes('--apply');
const RUN_ID = (process.argv.find((a) => a.startsWith('--run-id=')) || '').split('=')[1] || 'stage-v2-2026-07-03';
const BACKUP_PATH = path.join(ROOT, 'out', `stage-migration-backup-${RUN_ID}.json`);

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (!fs.existsSync(BACKUP_PATH)) { console.error(`No backup at ${BACKUP_PATH}`); process.exit(1); }
const { backup } = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — restore ${backup.length} stages (runId=${RUN_ID})`);
let n = 0;
for (const { id, stage } of backup) {
  if (APPLY) {
    const { error } = await sb.from('crm_people').update({ stage, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { console.error(`restore ${id}: ${error.message}`); process.exit(1); }
  }
  n++;
}
console.log(APPLY ? `RESTORED ${n} stages.` : `DRY-RUN — would restore ${n}.`);
