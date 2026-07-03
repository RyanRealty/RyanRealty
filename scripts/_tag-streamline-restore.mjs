#!/usr/bin/env node
/**
 * Tag streamline RESTORE v2 — undoes _tag-streamline-migrate.mjs --apply from the
 * immutable pre-image backup (out/streamline-backup-<runId>.json). Restores each
 * contact's tags + stage verbatim and nulls back the custom keys the migration wrote.
 * Idempotent.
 *
 *   node scripts/_tag-streamline-restore.mjs                    # DRY-RUN (default)
 *   node scripts/_tag-streamline-restore.mjs --apply            # write the pre-image back
 *   node scripts/_tag-streamline-restore.mjs --run-id=<id>      # pick a specific backup
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APPLY = process.argv.includes('--apply');
const RUN_ID = (process.argv.find((a) => a.startsWith('--run-id=')) || '').split('=')[1] || 'v2-2026-07-03';
const BACKUP_PATH = path.join(ROOT, 'out', `streamline-backup-${RUN_ID}.json`);

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (!fs.existsSync(BACKUP_PATH)) { console.error(`No backup at ${BACKUP_PATH} — nothing to restore.`); process.exit(1); }
const { backup } = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — backup holds ${backup.length} contacts (runId=${RUN_ID})`);

let restored = 0;
for (const { id, tags, stage, custom } of backup) {
  if (APPLY) {
    const cur = (await sb.from('crm_people').select('custom').eq('id', id).maybeSingle()).data?.custom ?? {};
    const merged = { ...cur };
    for (const k of Object.keys(custom || {})) delete merged[k]; // undo the field writes
    const { error } = await sb.from('crm_people')
      .update({ tags, stage, custom: merged, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { console.error(`restore ${id}: ${error.message}`); process.exit(1); }
  }
  restored += 1;
}
console.log(APPLY ? `RESTORED ${restored} contacts (tags + stage + fields).` : `DRY-RUN — would restore ${restored}. Pass --apply.`);
