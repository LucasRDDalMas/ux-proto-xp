import fs from 'node:fs';
import path from 'node:path';
import { ensureDir } from './fs.js';
import { runCommand } from './shell.js';

function buildGitArgs(args, options = {}) {
  const built = [];
  if (options.gitDir) {
    built.push(`--git-dir=${options.gitDir}`);
  }
  if (options.workTree) {
    built.push(`--work-tree=${options.workTree}`);
  }
  built.push(...args);
  return built;
}

export function runGit(args, options = {}) {
  const { cwd, gitDir, workTree, allowFailure = false, stdio = 'pipe' } = options;
  return runCommand('git', buildGitArgs(args, { gitDir, workTree }), {
    cwd,
    allowFailure,
    stdio
  });
}

export function ensureRepoClean(cwd, label) {
  const status = runGit(['status', '--porcelain'], { cwd }).stdout.trim();
  if (status.length > 0) {
    throw new Error(`${label} has local modifications. Commit/stash/revert them before running this command.`);
  }
}

export function initHiddenRepo(gitDir, workTree) {
  ensureDir(path.dirname(gitDir));
  runGit(['init'], { gitDir, workTree });
  runGit(['config', 'user.name', 'ux-proto'], { gitDir, workTree });
  runGit(['config', 'user.email', 'ux-proto@local'], { gitDir, workTree });

  const excludePath = path.join(gitDir, 'info', 'exclude');
  ensureDir(path.dirname(excludePath));

  const lines = [
    '.uxproto/meta.json',
    '.uxproto/versions/index.json',
    '.uxproto/logs/',
    'node_modules/',
    'dist/',
    'build/',
    '.cache/',
    '.DS_Store'
  ];

  const current = fs.existsSync(excludePath)
    ? fs.readFileSync(excludePath, 'utf8')
    : '';

  fs.writeFileSync(excludePath, `${current}${lines.join('\n')}\n`, 'utf8');
}

export function shortHead(gitDir, workTree) {
  return runGit(['rev-parse', '--short', 'HEAD'], { gitDir, workTree }).stdout.trim();
}

export function isWorkTreeClean(gitDir, workTree) {
  const output = runGit(['status', '--porcelain'], { gitDir, workTree }).stdout.trim();
  return output.length === 0;
}
