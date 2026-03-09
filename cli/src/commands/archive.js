import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, exists, removeIfExists } from '../core/fs.js';
import { isWorkTreeClean } from '../core/git.js';
import { withPrototypeLock } from '../core/lock.js';
import { loadMeta, parsePrototypeIdentity, requirePrototypeContext, saveMeta } from '../core/prototype.js';
import { saveVersion } from '../core/versioning.js';

function hasFlag(args, flag) {
  return args.includes(flag);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function archiveTimestamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function uniqueArchivePath(rootDir, baseName) {
  let candidate = path.join(rootDir, baseName);
  if (!exists(candidate)) {
    return candidate;
  }

  let suffix = 1;
  while (true) {
    candidate = path.join(rootDir, `${baseName}-${suffix}`);
    if (!exists(candidate)) {
      return candidate;
    }
    suffix += 1;
  }
}

export function archiveCommand(args) {
  const context = requirePrototypeContext(process.cwd());
  const { projectName, prototypeName } = parsePrototypeIdentity(context.workspaceRoot, context.prototypeRoot);

  return withPrototypeLock(context.workspaceRoot, context.prototypeRoot, `prototype ${projectName}/${prototypeName}`, () => {
    const meta = loadMeta(context.metaPath);
    const gitDir = path.join(context.workspaceRoot, meta.storage.gitDir);
    const autoSave = hasFlag(args, '--save');

    if (!isWorkTreeClean(gitDir, context.prototypeRoot)) {
      if (!autoSave) {
        throw new Error('Unsaved changes detected. Run proto save first or use proto archive --save.');
      }

      saveVersion({
        gitDir,
        prototypeRoot: context.prototypeRoot,
        versionsPath: context.versionsPath,
        metaPath: context.metaPath,
        meta,
        comment: 'archive checkpoint',
        allowEmpty: false
      });
    }

    const archiveProjectRoot = path.join(context.workspaceRoot, 'archive', projectName);
    ensureDir(archiveProjectRoot);

    const timestamp = archiveTimestamp();
    const archiveName = `${prototypeName}--${timestamp}`;
    const archivePath = uniqueArchivePath(archiveProjectRoot, archiveName);

    fs.renameSync(context.prototypeRoot, archivePath);

    const archivedMetaPath = path.join(archivePath, '.uxproto', 'meta.json');
    const archivedMeta = loadMeta(archivedMetaPath);
    archivedMeta.status = 'archived';
    archivedMeta.archivedAt = new Date().toISOString();
    saveMeta(archivedMetaPath, archivedMeta);

    removeIfExists(gitDir);

    console.log(`Archived ${projectName}/${prototypeName} -> ${archivePath}`);
  });
}
