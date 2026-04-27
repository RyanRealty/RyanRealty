#!/usr/bin/env node
/**
 * YouTube OAuth helper — runs the authorization-code flow with a loopback
 * redirect (http://127.0.0.1:8765/oauth2callback). Prints the auth URL,
 * waits for the user to approve, captures the code, exchanges for tokens,
 * and appends YOUTUBE_REFRESH_TOKEN=... to .env.local (does NOT clobber
 * existing keys).
 *
 * Reads GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET from
 * /Users/matthewryan/RyanRealty/.env.local
 *
 * Usage: node scripts/youtube-auth.mjs
 */

import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ENV_PATH = '/Users/matthewryan/RyanRealty/.env.local';
const REDIRECT_HOST = '127.0.0.1';
const REDIRECT_PORT = 8765;
const REDIRECT_URI = `http://${REDIRECT_HOST}:${REDIRECT_PORT}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
];

function parseEnv(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`Missing ${ENV_PATH}`);
  return parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
}

function upsertEnvKey(key, value) {
  const text = fs.readFileSync(ENV_PATH, 'utf8');
  const lines = text.split('\n');
  let found = false;
  const newLines = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)\s*=/);
    if (m && m[1] === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (newLines.length && newLines[newLines.length - 1] !== '') newLines.push('');
    newLines.push(`${key}=${value}`);
  }
  fs.writeFileSync(ENV_PATH, newLines.join('\n'));
}

async function main() {
  const env = loadEnv();
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set in .env.local');
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token
    scope: SCOPES,
    include_granted_scopes: true,
  });

  console.log('\n========================================================================');
  console.log('STEP 1 — Open this URL in your browser and approve YouTube access:');
  console.log('------------------------------------------------------------------------');
  console.log(authUrl);
  console.log('------------------------------------------------------------------------');
  console.log('STEP 2 — Choose the @Ryan-Realty channel/account when prompted.');
  console.log('STEP 3 — After "Allow", Google redirects to 127.0.0.1:8765 and this');
  console.log('         script will detect the code automatically. No copy/paste.');
  console.log('========================================================================\n');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, `http://${REDIRECT_HOST}:${REDIRECT_PORT}`);
        if (u.pathname !== '/oauth2callback') {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        const error = u.searchParams.get('error');
        if (error) {
          res.statusCode = 400;
          res.end(`OAuth error: ${error}`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }
        const c = u.searchParams.get('code');
        if (!c) {
          res.statusCode = 400;
          res.end('Missing code');
          return;
        }
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html><body style="font-family:system-ui;padding:40px;max-width:560px;margin:auto;">
<h1>YouTube auth complete.</h1>
<p>You can close this tab. Returning to the upload script&hellip;</p>
</body></html>`);
        server.close();
        resolve(c);
      } catch (e) {
        reject(e);
      }
    });
    server.on('error', reject);
    server.listen(REDIRECT_PORT, REDIRECT_HOST, () => {
      console.log(`[auth] listening on ${REDIRECT_URI}`);
    });
    // 12-hour timeout
    setTimeout(() => {
      reject(new Error('Timed out waiting for OAuth approval after 12 hours'));
      try { server.close(); } catch {}
    }, 12 * 60 * 60 * 1000).unref();
  });

  console.log('[auth] code received, exchanging for tokens...');
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh_token returned. Likely the consent screen was previously approved without prompt=consent. ' +
      'Visit https://myaccount.google.com/permissions, revoke the app, and re-run this script.'
    );
  }

  upsertEnvKey('YOUTUBE_REFRESH_TOKEN', tokens.refresh_token);
  console.log('[auth] saved YOUTUBE_REFRESH_TOKEN to', ENV_PATH);

  // Quick verification: fetch the channel to confirm correct account.
  oauth2.setCredentials(tokens);
  const yt = google.youtube({ version: 'v3', auth: oauth2 });
  try {
    const me = await yt.channels.list({ part: ['snippet'], mine: true });
    const ch = me.data.items?.[0];
    if (ch) {
      console.log(`[auth] authorized channel: ${ch.snippet.title} (${ch.id})`);
      if (ch.id !== 'UCpxIXnNVeG25oeDjfE3b4lw') {
        console.warn('[auth] WARNING: channel ID does not match expected @Ryan-Realty (UCpxIXnNVeG25oeDjfE3b4lw)');
      }
    }
  } catch (e) {
    console.warn('[auth] could not verify channel:', e.message);
  }

  console.log('\n[auth] DONE. You can now run: node scripts/youtube-upload.mjs');
}

main().catch((e) => {
  console.error('[auth] FAILED:', e.message);
  process.exit(1);
});
