#!/usr/bin/env node
/**
 * Pushes the tour content committed in this repo to the live site.
 *
 * Why this exists: since the admin page was first opened, the deployed site
 * reads its tour content from Netlify Blobs, not from src/data/tours.*.ts (see
 * src/data/tours.ts). Those files are now the seed and the disaster-recovery
 * snapshot, so editing them alone changes nothing on the live site. This script
 * is the bridge.
 *
 *   node scripts/sync-tour-content.mjs [--site https://example.netlify.app]
 *
 * It prints exactly what would change and asks for confirmation before writing.
 * The admin password is read from stdin rather than an argument, so it stays
 * out of shell history.
 *
 * WARNING: this replaces the live document with the repo's version. Anything
 * edited through the admin page and not mirrored back into the repo will be
 * lost. The diff below is shown precisely so that is never a surprise.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as esbuild from 'esbuild';

const DEFAULT_SITE = 'https://jovial-fenglisu-85a2da.netlify.app';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Loads the repo's seed builder.
 *
 * Bundled with esbuild rather than imported directly: the data modules use the
 * TypeScript convention of importing './tours.en.js' for a .ts file, which Node
 * does not resolve on its own.
 */
async function loadSeedBuilder() {
  const dir = mkdtempSync(join(tmpdir(), 'kanmon-seed-'));
  const outfile = join(dir, 'seed.mjs');
  try {
    await esbuild.build({
      entryPoints: [join(repoRoot, 'src/data/tourSeed.ts')],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      logLevel: 'error',
    });
    const mod = await import(pathToFileURL(outfile).href);
    return mod.buildSeedDoc;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function arg(name, fallback) {
  const index = argv.indexOf(name);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
}

const site = arg('--site', DEFAULT_SITE).replace(/\/$/, '');
const endpoint = `${site}/api/tour-content`;

/** A stable, comparable view of one tour — ignores id and ordering noise. */
function fingerprint(tour) {
  return JSON.stringify({ en: tour.en, ja: tour.ja });
}

function describeChanges(live, next) {
  const liveBySlug = new Map((live.tours ?? []).map((t) => [t.slug, t]));
  const nextBySlug = new Map(next.tours.map((t) => [t.slug, t]));
  const added = [];
  const removed = [];
  const changed = [];

  for (const [slug, tour] of nextBySlug) {
    const before = liveBySlug.get(slug);
    if (!before) added.push(`${tour.en.number} — ${tour.en.title}  (${slug})`);
    else if (fingerprint(before) !== fingerprint(tour)) changed.push(`${tour.en.number} — ${tour.en.title}  (${slug})`);
  }
  for (const [slug, tour] of liveBySlug) {
    if (!nextBySlug.has(slug)) removed.push(`${tour.en?.number ?? '?'} — ${tour.en?.title ?? slug}  (${slug})`);
  }
  return { added, removed, changed };
}

const rl = createInterface({ input: stdin });

/**
 * Reads one line, working the same way at a terminal and with piped input.
 *
 * readline's own question() rejects once a piped stream ends, which made the
 * confirmation step impossible to exercise in a test. Buffering lines instead
 * keeps both paths identical. A closed stream yields null, which every caller
 * treats as "no answer".
 */
const pending = [];
let waiting = null;
let closed = false;
rl.on('line', (line) => {
  if (waiting) { waiting(line); waiting = null; } else pending.push(line);
});
rl.on('close', () => {
  closed = true;
  if (waiting) { waiting(null); waiting = null; }
});

function ask(prompt) {
  stdout.write(prompt);
  if (pending.length) return Promise.resolve(pending.shift());
  if (closed) return Promise.resolve(null);
  return new Promise((resolve) => { waiting = resolve; });
}

try {
  const password = ((await ask('Admin password: ')) ?? '').trim();
  if (!password) {
    console.error('No password given.');
    exit(1);
  }

  process.stdout.write(`\nReading live content from ${endpoint} … `);
  const response = await fetch(endpoint, { headers: { 'X-Admin-Password': password } });
  if (!response.ok) {
    console.error(
      `\nCould not read the live content (HTTP ${response.status}).` +
        (response.status === 401 ? ' The password was rejected.' : '')
    );
    exit(1);
  }
  const live = await response.json();
  console.log(`ok — ${live.tours?.length ?? 0} tours, last updated ${live.updatedAt ?? 'unknown'}`);

  const buildSeedDoc = await loadSeedBuilder();
  const next = buildSeedDoc();
  const { added, removed, changed } = describeChanges(live, next);

  if (!added.length && !removed.length && !changed.length) {
    console.log('\nThe live content already matches this repo. Nothing to do.');
    exit(0);
  }

  console.log('\nThis will change the live content as follows:\n');
  for (const line of added) console.log(`  + added    ${line}`);
  for (const line of removed) console.log(`  - REMOVED  ${line}`);
  for (const line of changed) console.log(`  ~ changed  ${line}`);
  console.log(
    '\nAnything edited through the admin page that is not also in this repo will be overwritten.'
  );

  // Anything other than an explicit "yes" cancels, including the input stream
  // ending — failing closed matters more than a tidy prompt on a script that
  // overwrites live content.
  const answer = ((await ask('\nType "yes" to apply: ')) ?? '').trim();
  if (answer !== 'yes') {
    console.log('Cancelled. Nothing was changed.');
    exit(0);
  }

  const save = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, baseUpdatedAt: live.updatedAt, data: { tours: next.tours } }),
  });
  const body = await save.json().catch(() => ({}));
  if (!save.ok) {
    console.error(`\nSave failed (HTTP ${save.status}): ${body.error ?? 'unknown error'}`);
    exit(1);
  }

  console.log(`\nSaved. ${body.data.tours.length} tours are now stored.`);
  if (body.warning) console.log(`Note: ${body.warning}`);
  console.log(
    '\nThe website has NOT changed yet — open /admin/, go to Tour Content and press\n' +
      '"Publish to website" to rebuild the site with this content.'
  );
} finally {
  rl.close();
}
