import path from 'node:path';
import { exists, readJson, writeJson } from './fs.js';
import { requireWorkspaceRoot } from './workspace.js';

export function prototypePaths(workspaceRoot, projectName, prototypeName) {
  const prototypeRoot = path.join(workspaceRoot, 'prototypes', projectName, prototypeName);
  const uxprotoRoot = path.join(prototypeRoot, '.uxproto');
  const metaPath = path.join(uxprotoRoot, 'meta.json');
  const versionsPath = path.join(uxprotoRoot, 'versions', 'index.json');

  return {
    prototypeRoot,
    uxprotoRoot,
    metaPath,
    versionsPath
  };
}

export function parsePrototypeIdentity(workspaceRoot, prototypeRoot) {
  const relative = path.relative(path.join(workspaceRoot, 'prototypes'), prototypeRoot);
  const [projectName, prototypeName] = relative.split(path.sep);
  if (!projectName || !prototypeName) {
    throw new Error(`Invalid prototype path: ${prototypeRoot}`);
  }
  return { projectName, prototypeName };
}

export function findPrototypeRoot(startPath = process.cwd()) {
  const workspaceRoot = requireWorkspaceRoot(startPath);
  let current = path.resolve(startPath);

  while (true) {
    const metaPath = path.join(current, '.uxproto', 'meta.json');
    if (exists(metaPath)) {
      return {
        workspaceRoot,
        prototypeRoot: current,
        metaPath,
        versionsPath: path.join(current, '.uxproto', 'versions', 'index.json')
      };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function requirePrototypeContext(startPath = process.cwd()) {
  const context = findPrototypeRoot(startPath);
  if (!context) {
    throw new Error('Prototype not found. Run this command inside a prototype folder.');
  }
  return context;
}

export function loadMeta(metaPath) {
  if (!exists(metaPath)) {
    throw new Error(`Missing metadata file: ${metaPath}`);
  }
  return readJson(metaPath);
}

export function saveMeta(metaPath, meta) {
  writeJson(metaPath, meta);
}

export function loadVersions(versionsPath) {
  if (!exists(versionsPath)) {
    return { versions: [] };
  }

  const parsed = readJson(versionsPath);
  if (!parsed || !Array.isArray(parsed.versions)) {
    throw new Error(`Invalid versions file: ${versionsPath}`);
  }
  return parsed;
}

export function saveVersions(versionsPath, versions) {
  writeJson(versionsPath, { versions });
}
