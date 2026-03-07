import path from 'node:path';
import { exists, readJson } from './fs.js';

const WORKSPACE_MARKER = path.join('.ux-proto', 'workspace.json');

export function findWorkspaceRoot(startPath = process.cwd()) {
  let current = path.resolve(startPath);

  while (true) {
    const markerPath = path.join(current, WORKSPACE_MARKER);
    if (exists(markerPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function requireWorkspaceRoot(startPath = process.cwd()) {
  const root = findWorkspaceRoot(startPath);
  if (!root) {
    throw new Error('Workspace not found. Expected .ux-proto/workspace.json in current or parent directories.');
  }
  return root;
}

export function readWorkspaceMetadata(workspaceRoot) {
  const markerPath = path.join(workspaceRoot, WORKSPACE_MARKER);
  return readJson(markerPath);
}
