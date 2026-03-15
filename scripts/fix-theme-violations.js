#!/usr/bin/env node
/**
 * One-time script: replace remaining theme violations (text-white, bg-black, border-white)
 * with semantic tokens. Run from repo root: node scripts/fix-theme-violations.js
 */
const fs = require('fs');
const path = require('path');

const dirs = ['app', 'components'];
const excludeDir = new Set(['node_modules', '.next', 'components/ui']);

function walk(dir, cb) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!excludeDir.has(e.name)) walk(full, cb);
      } else if (e.name.endsWith('.tsx')) cb(full);
    }
  } catch (_) {}
}

let total = 0;
walk('app', (file) => { dirs.push(file); });
dirs.shift();
walk('components', (file) => { dirs.push(file); });
dirs.shift();

const files = [];
function collect(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!excludeDir.has(e.name)) collect(full);
      } else if (e.name.endsWith('.tsx')) files.push(full);
    }
  } catch (_) {}
}
collect('app');
collect('components');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const orig = content;
  // Semantic replacements (context-safe: primary surfaces)
  content = content.replace(/\btext-white\b/g, 'text-primary-foreground');
  content = content.replace(/\bhover:text-white\b/g, 'hover:text-primary-foreground');
  content = content.replace(/\btext-white\/(\d+)/g, 'text-primary-foreground/$1');
  content = content.replace(/\bbg-black\/(\d+)/g, 'bg-foreground/$1');
  content = content.replace(/\bborder-white\/(\d+)/g, 'border-primary-foreground/$1');
  content = content.replace(/\bbg-white\/10\b/g, 'bg-primary-foreground/10');
  // Success/destructive/warning buttons: use correct foreground
  content = content.replace(/bg-success[^"']*?\btext-primary-foreground\b/g, (m) => m.replace('text-primary-foreground', 'text-success-foreground'));
  content = content.replace(/bg-destructive[^"']*?\btext-primary-foreground\b/g, (m) => m.replace('text-primary-foreground', 'text-destructive-foreground'));
  content = content.replace(/bg-warning[^"']*?\btext-primary-foreground\b/g, (m) => m.replace('text-primary-foreground', 'text-warning-foreground'));
  content = content.replace(/file:text-primary-foreground\b/g, 'file:text-success-foreground');
  if (content !== orig) {
    fs.writeFileSync(file, content);
    total++;
    console.log('Fixed:', file);
  }
}
console.log('Total files updated:', total);
