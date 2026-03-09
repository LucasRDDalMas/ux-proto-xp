import path from 'node:path';
import { exists } from './fs.js';
import { runGit } from './git.js';
import { withSourceRepoLock } from './lock.js';

export function resolveSourcePaths(workspaceRoot, projectConfig) {
  const sourceRepoPath = path.resolve(workspaceRoot, projectConfig.sourcePath);
  const sourceAppPath = path.join(sourceRepoPath, projectConfig.appPath);

  if (!exists(sourceRepoPath)) {
    throw new Error(`Source repo path does not exist: ${sourceRepoPath}`);
  }

  if (!exists(sourceAppPath)) {
    throw new Error(`Configured appPath does not exist: ${sourceAppPath}`);
  }

  return { sourceRepoPath, sourceAppPath };
}

export function updateSourceRepo(sourceRepoPath, sourceBranch, options = {}) {
  const execute = () => {
    const dirty = runGit(['status', '--porcelain'], { cwd: sourceRepoPath }).stdout.trim();
    if (dirty.length > 0) {
      throw new Error(`Source repo has local modifications: ${sourceRepoPath}`);
    }

    const remotes = runGit(['remote'], { cwd: sourceRepoPath }).stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!remotes.includes('origin')) {
      throw new Error(`Source repo is missing required remote "origin": ${sourceRepoPath}`);
    }

    runGit(['fetch', 'origin'], { cwd: sourceRepoPath });
    runGit(['checkout', sourceBranch], { cwd: sourceRepoPath });
    runGit(['pull', '--ff-only', 'origin', sourceBranch], { cwd: sourceRepoPath });

    return runGit(['rev-parse', 'HEAD'], { cwd: sourceRepoPath }).stdout.trim();
  };

  if (!options.workspaceRoot) {
    return execute();
  }

  const lockLabel = options.lockLabel || `source repo ${sourceRepoPath}`;
  return withSourceRepoLock(options.workspaceRoot, sourceRepoPath, lockLabel, execute);
}
