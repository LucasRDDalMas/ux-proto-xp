import path from 'node:path';
import { listDirectories, exists } from '../core/fs.js';
import { loadMeta } from '../core/prototype.js';
import { displaySource, isTemplatePrototype } from '../core/prototype-runtime.js';
import { requireWorkspaceRoot } from '../core/workspace.js';

function printGroup(title, entries) {
  console.log(title);
  if (entries.length === 0) {
    console.log('  (none)');
    return;
  }

  for (const entry of entries) {
    console.log(`  - ${entry}`);
  }
}

function shortCommit(commit) {
  if (typeof commit !== 'string' || commit.length === 0) {
    return 'unknown';
  }
  return commit.slice(0, 7);
}

function listActive(workspaceRoot) {
  const prototypesRoot = path.join(workspaceRoot, 'prototypes');
  const projectNames = listDirectories(prototypesRoot);

  if (projectNames.length === 0) {
    console.log('No active prototypes.');
    return;
  }

  for (const projectName of projectNames) {
    const projectRoot = path.join(prototypesRoot, projectName);
    const prototypeNames = listDirectories(projectRoot);

    const rows = [];
    for (const prototypeName of prototypeNames) {
      const prototypeRoot = path.join(projectRoot, prototypeName);
      const metaPath = path.join(prototypeRoot, '.uxproto', 'meta.json');
      if (!exists(metaPath)) {
        continue;
      }
      const meta = loadMeta(metaPath);
      if (isTemplatePrototype(meta)) {
        rows.push(`${prototypeName}   v${meta.versioning.currentVersion}   ${meta.status}   template:${displaySource(meta)}`);
      } else {
        rows.push(`${prototypeName}   v${meta.versioning.currentVersion}   ${meta.status}   source:${shortCommit(meta.lastSyncedSourceCommit)}`);
      }
    }

    printGroup(projectName, rows);
  }
}

function listArchive(workspaceRoot) {
  const archiveRoot = path.join(workspaceRoot, 'archive');
  const projectNames = listDirectories(archiveRoot);

  if (projectNames.length === 0) {
    console.log('No archived prototypes.');
    return;
  }

  for (const projectName of projectNames) {
    const projectRoot = path.join(archiveRoot, projectName);
    const archiveEntries = listDirectories(projectRoot);

    const rows = [];
    for (const archiveEntry of archiveEntries) {
      const archiveMetaPath = path.join(projectRoot, archiveEntry, '.uxproto', 'meta.json');
      if (!exists(archiveMetaPath)) {
        rows.push(`${archiveEntry}   archived   source:unknown`);
        continue;
      }

      const meta = loadMeta(archiveMetaPath);
      const version = meta.versioning?.currentVersion ?? '?';
      if (isTemplatePrototype(meta)) {
        rows.push(`${archiveEntry}   v${version}   ${meta.status}   template:${displaySource(meta)}`);
      } else {
        rows.push(`${archiveEntry}   v${version}   ${meta.status}   source:${shortCommit(meta.lastSyncedSourceCommit)}`);
      }
    }

    printGroup(projectName, rows);
  }
}

export function listCommand(args) {
  const workspaceRoot = requireWorkspaceRoot(process.cwd());
  if (args[0] === 'archive') {
    listArchive(workspaceRoot);
    return;
  }
  listActive(workspaceRoot);
}
