import path from 'node:path';
import { getProjectConfig } from '../core/config.js';
import { loadMeta, requirePrototypeContext } from '../core/prototype.js';
import { resolveSourcePaths, updateSourceRepo } from '../core/source.js';
import { syncPrototype } from '../core/sync.js';

export function syncCommand() {
  const context = requirePrototypeContext(process.cwd());
  const meta = loadMeta(context.metaPath);
  const projectConfig = getProjectConfig(context.workspaceRoot, meta.sourceProject);

  const { sourceRepoPath } = resolveSourcePaths(context.workspaceRoot, projectConfig);
  const latestSourceCommit = updateSourceRepo(sourceRepoPath, projectConfig.sourceBranch);

  const result = syncPrototype({
    workspaceRoot: context.workspaceRoot,
    prototypeRoot: context.prototypeRoot,
    meta,
    metaPath: context.metaPath,
    versionsPath: context.versionsPath,
    projectConfig,
    sourceRepoPath,
    latestSourceCommit
  });

  if (!result.updated) {
    if (result.reason === 'already-up-to-date') {
      console.log('Sync skipped: prototype is already up to date with source.');
      return;
    }

    if (result.reason === 'conflict') {
      throw new Error('Sync conflict detected. Prototype files were not modified.');
    }
  }

  console.log(`Sync successful. New version: v${result.version} (source ${result.sourceCommit.slice(0, 7)})`);
}
