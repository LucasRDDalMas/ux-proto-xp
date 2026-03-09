import path from 'node:path';
import { loadMeta, parsePrototypeIdentity, requirePrototypeContext } from '../core/prototype.js';
import { isSyncEnabled } from '../core/prototype-runtime.js';
import { withPrototypeLock } from '../core/lock.js';
import { resolveSourcePaths, updateSourceRepo } from '../core/source.js';
import { syncPrototype } from '../core/sync.js';
import { getProjectConfig } from '../core/config.js';

export function syncCommand() {
  const context = requirePrototypeContext(process.cwd());
  const { projectName, prototypeName } = parsePrototypeIdentity(context.workspaceRoot, context.prototypeRoot);

  return withPrototypeLock(context.workspaceRoot, context.prototypeRoot, `prototype ${projectName}/${prototypeName}`, () => {
    const meta = loadMeta(context.metaPath);
    if (!isSyncEnabled(meta)) {
      const templateLabel = meta?.origin?.label || meta?.createdFrom?.templateKey || 'this template';
      throw new Error(`${templateLabel} prototypes do not support sync.`);
    }

    const projectConfig = getProjectConfig(context.workspaceRoot, meta.sourceProject);

    const { sourceRepoPath } = resolveSourcePaths(context.workspaceRoot, projectConfig);
    const latestSourceCommit = updateSourceRepo(sourceRepoPath, projectConfig.sourceBranch, {
      workspaceRoot: context.workspaceRoot,
      lockLabel: `source repo ${meta.sourceProject}`
    });

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
  });
}
