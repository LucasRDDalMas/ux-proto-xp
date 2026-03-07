import path from 'node:path';
import { ensureDir, writeJson } from './fs.js';
import { loadVersions, saveMeta, saveVersions } from './prototype.js';
import { runGit, shortHead } from './git.js';

function buildVersionComment(nextVersion, comment) {
  if (!comment) {
    return `uxproto: save v${nextVersion}`;
  }
  return `uxproto: save v${nextVersion} - ${comment}`;
}

function nextVersionNumber(versions) {
  if (versions.length === 0) {
    return 0;
  }
  return versions[versions.length - 1].number + 1;
}

export function initVersionFiles(versionsPath) {
  ensureDir(path.dirname(versionsPath));
  writeJson(versionsPath, { versions: [] });
}

export function saveVersion(options) {
  const {
    gitDir,
    prototypeRoot,
    versionsPath,
    metaPath,
    meta,
    comment = null,
    allowEmpty = false
  } = options;

  const versionsData = loadVersions(versionsPath);
  const nextVersion = nextVersionNumber(versionsData.versions);
  const message = buildVersionComment(nextVersion, comment);

  const status = runGit(['status', '--porcelain'], {
    gitDir,
    workTree: prototypeRoot
  }).stdout.trim();

  if (status.length === 0 && !allowEmpty) {
    return { saved: false, version: meta.versioning.currentVersion };
  }

  runGit(['add', '-A'], { gitDir, workTree: prototypeRoot });

  const commitArgs = ['commit', '-m', message];
  if (allowEmpty) {
    commitArgs.splice(1, 0, '--allow-empty');
  }
  runGit(commitArgs, { gitDir, workTree: prototypeRoot });

  const commit = shortHead(gitDir, prototypeRoot);
  const versionEntry = {
    number: nextVersion,
    commit,
    comment
  };

  const nextVersions = [...versionsData.versions, versionEntry];
  saveVersions(versionsPath, nextVersions);

  meta.versioning.currentVersion = nextVersion;
  saveMeta(metaPath, meta);

  return { saved: true, version: nextVersion, commit };
}

export function findVersionByNumber(versionsPath, versionNumber) {
  const versionsData = loadVersions(versionsPath);
  return versionsData.versions.find((entry) => entry.number === versionNumber) || null;
}
