import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isWorkTreeClean, runGit } from '../core/git.js';
import { replaceDirectoryContents, removeIfExists } from '../core/fs.js';
import { requirePrototypeContext, loadMeta, loadVersions, saveVersions } from '../core/prototype.js';
import { findVersionByNumber, saveVersion } from '../core/versioning.js';

export function rollbackCommand(args) {
  const [versionRaw] = args;
  if (versionRaw === undefined) {
    throw new Error('Usage: proto rollback <version-number>');
  }

  const versionNumber = Number.parseInt(versionRaw, 10);
  if (!Number.isInteger(versionNumber) || versionNumber < 0) {
    throw new Error(`Invalid version number: ${versionRaw}`);
  }

  const context = requirePrototypeContext(process.cwd());
  const meta = loadMeta(context.metaPath);
  const versionsData = loadVersions(context.versionsPath);
  const gitDir = path.join(context.workspaceRoot, meta.storage.gitDir);

  if (!isWorkTreeClean(gitDir, context.prototypeRoot)) {
    throw new Error('Unsaved changes detected. Run proto save before rollback.');
  }

  const target = findVersionByNumber(context.versionsPath, versionNumber);
  if (!target) {
    throw new Error(`Version v${versionNumber} does not exist.`);
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uxproto-rollback-'));
  const tempWorktree = path.join(tmpRoot, 'snapshot-worktree');

  try {
    runGit(['worktree', 'add', '--detach', tempWorktree, target.commit], {
      gitDir,
      workTree: context.prototypeRoot
    });

    replaceDirectoryContents(context.prototypeRoot, tempWorktree, {
      excludeSourceNames: new Set(['.git'])
    });

    // Keep control-plane files in working tree state; they are not versioned.
    saveVersions(context.versionsPath, versionsData.versions);
    meta.versioning.currentVersion = versionsData.versions.at(-1)?.number ?? -1;
  } finally {
    runGit(['worktree', 'remove', '--force', tempWorktree], {
      gitDir,
      workTree: context.prototypeRoot,
      allowFailure: true
    });
    removeIfExists(tmpRoot);
  }

  const result = saveVersion({
    gitDir,
    prototypeRoot: context.prototypeRoot,
    versionsPath: context.versionsPath,
    metaPath: context.metaPath,
    meta,
    comment: `rollback to v${versionNumber}`,
    allowEmpty: true
  });

  console.log(`Rolled back to v${versionNumber}. New current version: v${result.version}`);
}
