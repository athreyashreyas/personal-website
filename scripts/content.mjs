#!/usr/bin/env node
/**
 * Friendly content version control on top of git.
 *
 * Your posts, projects, and images are plain files in this repo, so every
 * publish is a git commit you can return to. These commands make that safe
 * and intuitive without needing to remember git:
 *
 *   npm run content:status     what changed since the last publish
 *   npm run content:publish    save a restore point (commit) + push live
 *   npm run content:undo       throw away unpublished edits (wrong saves)
 *   npm run content:history    list recent publishes you can restore
 *   npm run content:restore    bring back an earlier version
 *
 * Nothing here is destructive without showing you exactly what it will do
 * and asking first.
 */
import { execSync, spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

// The only things these commands ever touch:
const PATHS = ['src/content', 'public/images'];

const c = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function git(args, { capture = true } = {}) {
  if (capture) {
    return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
  }
  return spawnSync('git', args, { stdio: 'inherit' });
}

function ensureRepo() {
  try {
    git('rev-parse --is-inside-work-tree');
  } catch {
    console.error(c.red('Not a git repository. Run these from the project root.'));
    process.exit(1);
  }
}

/** Working-tree changes (tracked + untracked) within the content paths. */
function changes() {
  const out = git(`status --porcelain -- ${PATHS.join(' ')}`);
  if (!out) return [];
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => ({ code: line.slice(0, 2), file: line.slice(3) }));
}

function describeCode(code) {
  if (code.includes('?')) return c.green('new');
  if (code.includes('D')) return c.red('deleted');
  if (code.includes('M')) return c.yellow('edited');
  if (code.includes('R')) return c.cyan('renamed');
  return code.trim();
}

async function confirm(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`${question} ${c.dim('(y/N)')} `)).trim().toLowerCase();
  rl.close();
  return answer === 'y' || answer === 'yes';
}

// ---------------------------------------------------------------- commands

function cmdStatus() {
  const list = changes();
  if (list.length === 0) {
    console.log(c.green('✓ Nothing unpublished — your content matches the last saved version.'));
    return;
  }
  console.log(c.b('Unpublished changes since your last publish:\n'));
  for (const { code, file } of list) {
    console.log(`  ${describeCode(code).padEnd(18)} ${file}`);
  }
  console.log(
    c.dim(`\nPublish them with ${c.b('npm run content:publish')}, or discard with ${c.b('npm run content:undo')}.`),
  );
}

async function cmdPublish() {
  const list = changes();
  if (list.length === 0) {
    console.log(c.green('✓ Nothing to publish — no content changes since the last publish.'));
    return;
  }
  cmdStatus();
  const msgArg = process.argv.slice(3).join(' ').trim();
  const stamp = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const message = msgArg || `Content update — ${stamp}`;

  console.log('');
  if (!(await confirm(`Publish these as a restore point titled ${c.b(`"${message}"`)}?`))) {
    console.log(c.dim('Cancelled. Nothing was published.'));
    return;
  }

  git(`add -- ${PATHS.join(' ')}`);
  git(`commit -m ${JSON.stringify(message)}`, { capture: false });
  console.log(c.green('\n✓ Saved a restore point.'));

  // Push if there's an upstream/remote; otherwise just keep the local commit.
  let hasRemote = false;
  try {
    hasRemote = git('remote').length > 0;
  } catch {
    hasRemote = false;
  }
  if (hasRemote) {
    console.log(c.dim('Pushing to trigger a deploy…'));
    const res = git(['push'], { capture: false });
    if (res.status === 0) {
      console.log(c.green('✓ Pushed. Netlify will redeploy shortly.'));
    } else {
      console.log(
        c.yellow('\nCommitted locally, but push failed (no upstream branch?).'),
      );
      console.log(c.dim('Set it once with:  git push -u origin main'));
    }
  } else {
    console.log(c.dim('No git remote configured yet — the restore point is saved locally.'));
  }
}

async function cmdUndo() {
  const list = changes();
  if (list.length === 0) {
    console.log(c.green('✓ Nothing to undo — no unpublished changes.'));
    return;
  }
  // Undo means "go back to the last published version" — so one must exist.
  const hasBaseline = git(`log -1 --pretty=format:%h -- ${PATHS.join(' ')}`).length > 0;
  if (!hasBaseline) {
    console.log(c.yellow('There is no published version yet to restore to.'));
    console.log(
      c.dim(`Create your first restore point with ${c.b('npm run content:publish')} — after that, undo can roll back to it.`),
    );
    return;
  }
  console.log(c.b('This will discard the following unpublished changes and restore the last published version:\n'));
  for (const { code, file } of list) {
    console.log(`  ${describeCode(code).padEnd(18)} ${file}`);
  }
  console.log(c.red('\nDiscarded edits cannot be recovered (they were never published).'));
  if (!(await confirm('\nRestore the last published version?'))) {
    console.log(c.dim('Cancelled. Your edits are untouched.'));
    return;
  }
  // Restore tracked files to HEAD, and remove newly-added (untracked) ones.
  git(`restore --source=HEAD --staged --worktree -- ${PATHS.join(' ')}`);
  git(`clean -fd -- ${PATHS.join(' ')}`);
  console.log(c.green('\n✓ Restored to the last published version.'));
}

function cmdHistory() {
  const raw = git(
    `log --pretty=format:%h%x09%cr%x09%s -n 20 -- ${PATHS.join(' ')}`,
  );
  if (!raw) {
    console.log(c.dim('No publishes yet.'));
    return;
  }
  const rows = raw.split('\n').filter(Boolean);
  console.log(c.b('Recent publishes (newest first):\n'));
  rows.forEach((row, i) => {
    const [hash, when, subject] = row.split('\t');
    const tag = i === 0 ? c.green('  ← current') : '';
    console.log(`  ${c.b(String(i).padStart(2))}  ${c.cyan(hash)}  ${when.padEnd(16)}  ${subject}${tag}`);
  });
  console.log(
    c.dim(`\nRestore one with ${c.b('npm run content:restore -- <number or hash>')} (e.g. ${c.b('… -- 1')}).`),
  );
}

async function cmdRestore() {
  const ref = process.argv[3];
  if (!ref) {
    console.log(c.yellow('Which version? Run ') + c.b('npm run content:history') + c.yellow(' to see them, then:'));
    console.log(c.dim('  npm run content:restore -- <number or hash>'));
    return;
  }
  if (changes().length > 0) {
    console.log(c.yellow('You have unpublished changes. Publish or undo them first:'));
    console.log(c.dim('  npm run content:status'));
    return;
  }
  // A small integer means "N publishes back"; otherwise treat as a commit hash.
  let commit = ref;
  if (/^\d+$/.test(ref)) {
    const raw = git(`log --pretty=format:%h -n 30 -- ${PATHS.join(' ')}`).split('\n');
    const idx = Number(ref);
    if (idx >= raw.length) {
      console.log(c.red(`There aren't that many publishes. See ${c.b('npm run content:history')}.`));
      return;
    }
    commit = raw[idx];
  }
  const subject = git(`log -1 --pretty=format:%s ${commit}`);
  console.log(`This will bring your content back to:\n  ${c.cyan(commit)}  ${subject}\n`);
  if (!(await confirm('Restore this version into your working files?'))) {
    console.log(c.dim('Cancelled.'));
    return;
  }
  git(`checkout ${commit} -- ${PATHS.join(' ')}`);
  console.log(c.green('\n✓ Restored those files into your working copy.'));
  console.log(
    c.dim(`Review with ${c.b('npm run dev')}, then make it live with ${c.b('npm run content:publish')}.`),
  );
}

// ---------------------------------------------------------------- dispatch

const command = process.argv[2];
ensureRepo();

const commands = {
  status: cmdStatus,
  publish: cmdPublish,
  undo: cmdUndo,
  history: cmdHistory,
  restore: cmdRestore,
};

const run = commands[command];
if (!run) {
  console.log(c.b('Content versioning — commands:\n'));
  console.log(`  ${c.b('npm run content:status')}    what changed since your last publish`);
  console.log(`  ${c.b('npm run content:publish')}   save a restore point + push live`);
  console.log(`  ${c.b('npm run content:undo')}      throw away unpublished edits`);
  console.log(`  ${c.b('npm run content:history')}   list versions you can restore`);
  console.log(`  ${c.b('npm run content:restore')}   bring back an earlier version`);
  process.exit(0);
}

await run();
