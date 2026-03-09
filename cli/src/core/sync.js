import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyDirFiltered, ensureDir, removeIfExists, replaceDirectoryContents } from './fs.js';
import { runGit, isWorkTreeClean } from './git.js';
import { saveVersion } from './versioning.js';
import { saveMeta } from './prototype.js';

function sourceWorktreePath(tmpRoot, label) {
  return path.join(tmpRoot, `source-${label}`);
}

function exportSourceSnapshot(options) {
  const {
    sourceRepoPath,
    commit,
    appPath,
    destinationPath,
    tmpRoot,
    label
  } = options;

  const worktreePath = sourceWorktreePath(tmpRoot, label);
  runGit(['worktree', 'add', '--detach', worktreePath, commit], { cwd: sourceRepoPath });

  try {
    const sourceAppPath = path.join(worktreePath, appPath);
    if (!fs.existsSync(sourceAppPath)) {
      throw new Error(`Configured appPath not found at commit ${commit}: ${sourceAppPath}`);
    }

    copyDirFiltered(sourceAppPath, destinationPath, {
      excludeNames: new Set(['.git', 'node_modules', '.cache'])
    });
  } finally {
    runGit(['worktree', 'remove', '--force', worktreePath], {
      cwd: sourceRepoPath,
      allowFailure: true
    });
  }
}

function commitSnapshot(mergeRepoPath, snapshotPath, message) {
  replaceDirectoryContents(mergeRepoPath, snapshotPath, {
    preserveTargetNames: new Set(['.git']),
    excludeSourceNames: new Set(['.git'])
  });

  runGit(['add', '-A'], { cwd: mergeRepoPath });
  runGit(['commit', '--allow-empty', '-m', message], { cwd: mergeRepoPath });
}

function buildMergeResult(basePath, oursPath, theirsPath, tmpRoot) {
  const mergeRepoPath = path.join(tmpRoot, 'merge-repo');
  ensureDir(mergeRepoPath);

  runGit(['init'], { cwd: mergeRepoPath });
  runGit(['config', 'user.name', 'ux-proto'], { cwd: mergeRepoPath });
  runGit(['config', 'user.email', 'ux-proto@local'], { cwd: mergeRepoPath });

  commitSnapshot(mergeRepoPath, basePath, 'base');
  const baseCommit = runGit(['rev-parse', 'HEAD'], { cwd: mergeRepoPath }).stdout.trim();

  runGit(['checkout', '-b', 'ours'], { cwd: mergeRepoPath });
  commitSnapshot(mergeRepoPath, oursPath, 'ours');

  runGit(['checkout', '-b', 'theirs', baseCommit], { cwd: mergeRepoPath });
  commitSnapshot(mergeRepoPath, theirsPath, 'theirs');

  runGit(['checkout', 'ours'], { cwd: mergeRepoPath });

  const mergeResult = runGit(['merge', '--no-commit', '--no-ff', 'theirs'], {
    cwd: mergeRepoPath,
    allowFailure: true
  });

  if (mergeResult.exitCode !== 0) {
    runGit(['merge', '--abort'], { cwd: mergeRepoPath, allowFailure: true });
    return { conflict: true, mergeRepoPath };
  }

  return { conflict: false, mergeRepoPath };
}

export function syncPrototype(options) {
  const {
    workspaceRoot,
    prototypeRoot,
    meta,
    metaPath,
    versionsPath,
    projectConfig,
    sourceRepoPath,
    latestSourceCommit
  } = options;

  const gitDir = path.join(workspaceRoot, meta.storage.gitDir);

  if (!isWorkTreeClean(gitDir, prototypeRoot)) {
    throw new Error('Unsaved changes detected. Run proto save before proto sync.');
  }

  const baseCommit = meta.lastSyncedSourceCommit;
  if (!baseCommit) {
    throw new Error('Metadata is missing lastSyncedSourceCommit. Cannot run sync.');
  }

  if (baseCommit === latestSourceCommit) {
    return { updated: false, reason: 'already-up-to-date' };
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uxproto-sync-'));

  try {
    const basePath = path.join(tmpRoot, 'base');
    const oursPath = path.join(tmpRoot, 'ours');
    const theirsPath = path.join(tmpRoot, 'theirs');

    exportSourceSnapshot({
      sourceRepoPath,
      commit: baseCommit,
      appPath: projectConfig.appPath,
      destinationPath: basePath,
      tmpRoot,
      label: 'base'
    });

    exportSourceSnapshot({
      sourceRepoPath,
      commit: latestSourceCommit,
      appPath: projectConfig.appPath,
      destinationPath: theirsPath,
      tmpRoot,
      label: 'theirs'
    });

    copyDirFiltered(prototypeRoot, oursPath, {
      excludeNames: new Set(['.uxproto', 'node_modules', '.cache'])
    });

    const merge = buildMergeResult(basePath, oursPath, theirsPath, tmpRoot);

    if (merge.conflict) {
      return { updated: false, reason: 'conflict' };
    }

    replaceDirectoryContents(prototypeRoot, merge.mergeRepoPath, {
      preserveTargetNames: new Set(['.uxproto']),
      excludeSourceNames: new Set(['.git'])
    });

    meta.lastSyncedSourceCommit = latestSourceCommit;
    saveMeta(metaPath, meta);

    const shortCommit = latestSourceCommit.slice(0, 7);
    const result = saveVersion({
      gitDir,
      prototypeRoot,
      versionsPath,
      metaPath,
      meta,
      comment: `sync from ${meta.sourceProject}@${shortCommit}`,
      allowEmpty: true
    });

    return {
      updated: true,
      version: result.version,
      sourceCommit: latestSourceCommit
    };
  } finally {
    removeIfExists(tmpRoot);
  }
}
