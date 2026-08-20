#!/usr/bin/env node
/**
 * Kill stray dev servers and clear the caches that go bad.
 *
 * Two things bite repeatedly on this machine:
 *
 *  1. Orphaned `astro dev` processes. A dev server that isn't shut down cleanly
 *     keeps its port and its esbuild service alive; the next one can't bind and
 *     dies quietly, so it looks like "the build is broken".
 *
 *  2. iCloud Drive. The project has since moved to ~/Projects, which iCloud does
 *     not touch — but the damage pattern is worth keeping described, because it
 *     is silent and it recurs the moment anything lands back under a synced
 *     folder (~/Desktop, ~/Documents). iCloud resolves write conflicts by
 *     duplicating: node_modules/.vite
 *     ends up holding `deps 2` … `deps 16`, dist gets `index 2.html`, and .git
 *     collects `index 2`. Vite then reads a cache that is half someone else's.
 *     Worse, an evicted (dataless) file blocks read() until iCloud materialises
 *     it, which is what a hung build with no output actually is.
 *
 * This clears the generated directories and the duplicates inside them. It does
 * NOT touch .git — stray copies in there are inert, but they're yours to remove.
 *
 * Run directly (`npm run clean`) or via the `prebuild` hook in package.json.
 */
import { execSync } from 'node:child_process';
import { rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not `.pathname`: the latter hands back a percent-encoded URL
// path, so a project living under a directory with a space in it ("My
// Projects" → "My%20Projects") yields a path that matches nothing. pgrep then
// finds no dev server and rmSync silently clears nothing.
const root = fileURLToPath(new URL('..', import.meta.url));
const quiet = process.argv.includes('--quiet');
const log = (...a) => !quiet && console.log(...a);

/** Kill anything still holding this project's dev server or its esbuild service. */
function killStrays() {
  // Matched on the project path so a dev server for another repo is left alone.
  const patterns = [`${root}node_modules/.bin/astro`, `${root}node_modules/vite`];
  let killed = 0;
  for (const p of patterns) {
    try {
      const pids = execSync(`pgrep -f ${JSON.stringify(p)}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
        .split('\n')
        .filter(Boolean)
        // Never kill ourselves, or the npm process that invoked us.
        .filter((pid) => Number(pid) !== process.pid && Number(pid) !== process.ppid);
      for (const pid of pids) {
        try {
          process.kill(Number(pid), 'SIGKILL');
          killed++;
        } catch {
          /* already gone */
        }
      }
    } catch {
      /* pgrep exits non-zero when nothing matches */
    }
  }
  log(killed ? `· killed ${killed} stray process${killed === 1 ? '' : 'es'}` : '· no stray processes');
}

/** Generated directories. All regenerate; none are worth keeping when suspect. */
function clearCaches() {
  for (const dir of ['node_modules/.vite', '.astro', 'dist']) {
    const path = join(root, dir);
    if (!existsSync(path)) continue;
    rmSync(path, { recursive: true, force: true });
    log(`· cleared ${dir}`);
  }
}

/** Report iCloud's conflict copies anywhere they survived, so they're visible. */
function reportDuplicates() {
  const dupes = [];
  const scan = (dir, depth = 0) => {
    if (depth > 3) return;
    let entries;
    try {
      entries = readdirSync(join(root, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' && depth === 0) continue;
      // "deps 2", "index 2.html" — a space then digits before the extension.
      if (/ \d+(\.[^.]+)?$/.test(e.name)) dupes.push(join(dir, e.name));
      if (e.isDirectory()) scan(join(dir, e.name), depth + 1);
    }
  };
  scan('.');
  if (dupes.length) {
    log(`\n! iCloud conflict copies still present (${dupes.length}):`);
    dupes.slice(0, 10).forEach((d) => log(`    ${d}`));
    if (dupes.length > 10) log(`    …and ${dupes.length - 10} more`);
    log('  These are iCloud conflict copies, which means this checkout is inside');
    log('  a synced folder (~/Desktop, ~/Documents). Until it moves out — or that');
    log('  folder stops syncing — they keep coming back and builds intermittently');
    log('  hang on a blocking read of an evicted file.');
  }
}

killStrays();
clearCaches();
reportDuplicates();
