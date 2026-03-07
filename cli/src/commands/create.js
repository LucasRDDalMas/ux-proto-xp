import path from 'node:path';
import { getProjectConfig, normalizeCommand } from '../core/config.js';
import { copyDirFiltered, ensureDir, exists, removeIfExists, writeJson } from '../core/fs.js';
import { initHiddenRepo } from '../core/git.js';
import { prototypePaths } from '../core/prototype.js';
import { runCommand } from '../core/shell.js';
import { resolveSourcePaths, updateSourceRepo } from '../core/source.js';
import { saveVersion, initVersionFiles } from '../core/versioning.js';
import { requireWorkspaceRoot } from '../core/workspace.js';

function createMetadata({ projectName, prototypeName, projectConfig, sourceCommit, gitDirRel }) {
  return {
    prototypeName,
    sourceProject: projectName,
    status: 'active',
    createdFrom: {
      sourcePath: projectConfig.sourcePath,
      sourceBranch: projectConfig.sourceBranch,
      sourceCommit,
      appPath: projectConfig.appPath
    },
    lastSyncedSourceCommit: sourceCommit,
    versioning: {
      currentVersion: 0
    },
    storage: {
      gitDir: gitDirRel
    },
    mock: {
      enabled: Boolean(projectConfig.mock?.enabled),
      seedPath: '.uxproto/mock/seed.json',
      statePath: '.uxproto/mock/state.json'
    }
  };
}

function initializeMockFiles(prototypeRoot, projectConfig) {
  if (!projectConfig.mock?.enabled) {
    return;
  }

  const mockRoot = path.join(prototypeRoot, '.uxproto', 'mock');
  ensureDir(mockRoot);

  const seedPath = path.join(mockRoot, 'seed.json');
  const statePath = path.join(mockRoot, 'state.json');

  if (!exists(seedPath)) {
    writeJson(seedPath, {});
  }

  if (!exists(statePath)) {
    writeJson(statePath, {});
  }
}

export function createCommand(args) {
  const [projectName, prototypeName] = args;

  if (!projectName || !prototypeName) {
    throw new Error('Usage: proto create <project> <prototype-name>');
  }

  const workspaceRoot = requireWorkspaceRoot(process.cwd());
  if (path.resolve(process.cwd()) !== path.resolve(workspaceRoot)) {
    throw new Error('proto create must be run from the workspace root.');
  }

  const projectConfig = getProjectConfig(workspaceRoot, projectName);
  const { sourceRepoPath, sourceAppPath } = resolveSourcePaths(workspaceRoot, projectConfig);

  const paths = prototypePaths(workspaceRoot, projectName, prototypeName);
  if (exists(paths.prototypeRoot)) {
    throw new Error(`Prototype already exists: ${paths.prototypeRoot}`);
  }

  const gitDirRel = `.ux-proto/repos/${projectName}/${prototypeName}.git`;
  const gitDirAbs = path.join(workspaceRoot, gitDirRel);

  let copied = false;

  try {
    const latestSourceCommit = updateSourceRepo(sourceRepoPath, projectConfig.sourceBranch);

    copyDirFiltered(sourceAppPath, paths.prototypeRoot, {
      excludeNames: new Set(['.git', 'node_modules', 'dist', 'build', '.cache'])
    });
    copied = true;

    ensureDir(paths.uxprotoRoot);
    initHiddenRepo(gitDirAbs, paths.prototypeRoot);
    initVersionFiles(paths.versionsPath);

    const meta = createMetadata({
      projectName,
      prototypeName,
      projectConfig,
      sourceCommit: latestSourceCommit,
      gitDirRel
    });

    writeJson(paths.metaPath, meta);
    initializeMockFiles(paths.prototypeRoot, projectConfig);

    const installCommand = normalizeCommand(projectConfig.installCommand, 'installCommand');
    runCommand(installCommand[0], installCommand.slice(1), {
      cwd: paths.prototypeRoot,
      stdio: 'inherit'
    });

    const save = saveVersion({
      gitDir: gitDirAbs,
      prototypeRoot: paths.prototypeRoot,
      versionsPath: paths.versionsPath,
      metaPath: paths.metaPath,
      meta,
      comment: 'initial',
      allowEmpty: true
    });

    console.log(`Created prototype ${projectName}/${prototypeName} at ${paths.prototypeRoot}`);
    console.log(`Initialized version v${save.version}`);
    console.log(`Next: cd ${paths.prototypeRoot}`);
    console.log('Then: proto run');
  } catch (error) {
    if (copied) {
      removeIfExists(paths.prototypeRoot);
    }
    removeIfExists(gitDirAbs);
    throw error;
  }
}
