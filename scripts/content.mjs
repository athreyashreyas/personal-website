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
import { spawnSync } from 'node:child_process';
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

/**
 * Runs git and returns its stdout, throwing on a non-zero exit.
 *
 * argv is always an array — never an interpolated command string — so paths and
 * user-supplied refs can't be re-split on spaces or interpreted by a shell.
 *
 * `trim: false` for output whose leading whitespace is significant: a porcelain
 * status line starts with the two-character code, and an unstaged edit's code
 * is " M", so trimming would shift every field of the first entry by one.
 */
function git(argv, { trim = true } = {}) {
  const res = spawnSync('git', argv, { encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(res.stderr?.trim() || `git ${argv.join(' ')} failed`);
  }
  return trim ? res.stdout.trim() : res.stdout;
}

/** Runs git attached to this terminal (so it can print/prompt). Returns the exit code. */
function gitInteractive(argv) {
  const res = spawnSync('git', argv, { stdio: 'inherit' });
  if (res.error) throw res.error;
  return res.status ?? 1;
}

function ensureRepo() {
  try {
    git(['rev-parse', '--is-inside-work-tree']);
  } catch {
    console.error(c.red('Not a git repository. Run these from the project root.'));
    process.exit(1);
  }
}

/**
 * Working-tree changes (tracked + untracked) within the content paths.
 *
 * `-z` because git otherwise quotes and escapes paths containing spaces or
 * non-ASCII — both of which are ordinary in image filenames here.
 */
function changes() {
  const out = git(['status', '--porcelain', '-z', '--', ...PATHS], { trim: false });
  if (!out) return [];
  const entries = out.split('\0');
  const list = [];
  for (let i = 0; i < entries.length; i++) {
    if (!entries[i]) continue;
    const code = entries[i].slice(0, 2);
    const file = entries[i].slice(3);
    // A rename/copy is followed by its source path as a separate field.
    if (code[0] === 'R' || code[0] === 'C') i++;
    list.push({ code, file });
  }
  return list;
}

/** The content paths that actually have files at `ref` — git rejects pathspecs matching nothing. */
function pathsIn(ref) {
  return PATHS.filter((p) => {
    try {
      return git(['ls-tree', '-r', '--name-only', ref, '--', p]).length > 0;
    } catch {
      return false;
    }
  });
}

function describeCode(code) {
  if (code.includes('?')) return c.green('new');
  if (code.includes('R')) return c.cyan('renamed');
  if (code.includes('D')) return c.red('deleted');
  if (code.includes('A')) return c.green('added');
  if (code.includes('M')) return c.yellow('edited');
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

  git(['add', '--', ...PATHS]);
  if (gitInteractive(['commit', '-m', message]) !== 0) {
    console.log(c.red('\nCommit failed — nothing was published.'));
    return;
  }
  console.log(c.green('\n✓ Saved a restore point.'));

  // Push if there's an upstream/remote; otherwise just keep the local commit.
  let hasRemote = false;
  try {
    hasRemote = git(['remote']).length > 0;
  } catch {
    hasRemote = false;
  }
  if (hasRemote) {
    console.log(c.dim('Pushing to trigger a deploy…'));
    if (gitInteractive(['push']) === 0) {
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
  const hasBaseline = git(['log', '-1', '--pretty=format:%h', '--', ...PATHS]).length > 0;
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
  // Only pass paths that HEAD actually has files under — git errors out on a
  // pathspec that matches nothing, which would abort the whole undo (e.g. when
  // no images have ever been committed).
  const restorable = pathsIn('HEAD');
  if (restorable.length > 0) {
    git(['restore', '--source=HEAD', '--staged', '--worktree', '--', ...restorable]);
  }
  git(['clean', '-fd', '--', ...PATHS]);
  console.log(c.green('\n✓ Restored to the last published version.'));
}

function cmdHistory() {
  const raw = git([
    'log',
    '--pretty=format:%h%x09%cr%x09%s',
    '-n',
    '20',
    '--',
    ...PATHS,
  ]);
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
    const raw = git(['log', '--pretty=format:%h', '-n', '30', '--', ...PATHS]).split('\n');
    const idx = Number(ref);
    if (idx >= raw.length) {
      console.log(c.red(`There aren't that many publishes. See ${c.b('npm run content:history')}.`));
      return;
    }
    commit = raw[idx];
  } else if (!/^[0-9a-fA-F]{4,40}$/.test(ref)) {
    console.log(c.red(`"${ref}" doesn't look like a version number or commit hash.`));
    console.log(c.dim(`See ${c.b('npm run content:history')} for the ones you can restore.`));
    return;
  }

  let subject;
  try {
    subject = git(['log', '-1', '--pretty=format:%s', commit]);
  } catch {
    console.log(c.red(`No publish found for ${c.b(commit)}.`));
    console.log(c.dim(`See ${c.b('npm run content:history')} for the ones you can restore.`));
    return;
  }
  console.log(`This will bring your content back to:\n  ${c.cyan(commit)}  ${subject}\n`);
  if (!(await confirm('Restore this version into your working files?'))) {
    console.log(c.dim('Cancelled.'));
    return;
  }
  const restorable = pathsIn(commit);
  if (restorable.length === 0) {
    console.log(c.yellow('That version has no content files to restore.'));
    return;
  }
  git(['checkout', commit, '--', ...restorable]);
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

// Nothing here should ever greet you with a stack trace — git's own message is
// the useful part, and everything these commands do is recoverable.
try {
  await run();
} catch (err) {
  console.error(c.red(`\nSomething went wrong: ${err.message}`));
  console.error(c.dim('Your files were not changed by this command.'));
  process.exit(1);
}
