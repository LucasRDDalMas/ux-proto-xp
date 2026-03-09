#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadProjectsConfig } from '../core/config.js';
import { printCliError } from '../core/errors.js';
import { withSourceRepoLock } from '../core/lock.js';
import { runCommand } from '../core/shell.js';
import { requireWorkspaceRoot } from '../core/workspace.js';

function git(cwd, args, options = {}) {
  return runCommand('git', args, { cwd, ...options });
}

function ensureProjectConfig(projectName, projectConfig) {
  const required = ['sourcePath', 'sourceUrl', 'sourceBranch'];
  for (const key of required) {
    if (typeof projectConfig[key] !== 'string' || projectConfig[key].trim().length === 0) {
      throw new Error(`Project "${projectName}" is missing required string key "${key}" in config/projects.json.`);
    }
  }
}

function ensureOrigin(projectPath, sourceUrl) {
  const current = git(projectPath, ['remote', 'get-url', 'origin'], { allowFailure: true });

  if (current.exitCode !== 0) {
    git(projectPath, ['remote', 'add', 'origin', sourceUrl]);
    return;
  }

  const currentUrl = current.stdout.trim();
  if (currentUrl !== sourceUrl) {
    git(projectPath, ['remote', 'set-url', 'origin', sourceUrl]);
  }
}

function checkoutBranch(projectPath, sourceBranch) {
  const checkout = git(projectPath, ['checkout', sourceBranch], { allowFailure: true });
  if (checkout.exitCode === 0) {
    return;
  }

  git(projectPath, ['checkout', '-B', sourceBranch, `origin/${sourceBranch}`]);
}

function updateExistingRepo(projectName, projectPath, sourceUrl, sourceBranch) {
  const dirty = git(projectPath, ['status', '--porcelain']).stdout.trim();
  if (dirty.length > 0) {
    throw new Error(`Cannot update ${projectName}: local modifications found in ${projectPath}`);
  }

  ensureOrigin(projectPath, sourceUrl);

  console.log(`Updating ${projectName} at ${projectPath}`);
  git(projectPath, ['fetch', 'origin']);
  checkoutBranch(projectPath, sourceBranch);
  git(projectPath, ['pull', '--ff-only', 'origin', sourceBranch]);
}

function cloneRepo(projectName, projectPath, sourceUrl, sourceBranch) {
  console.log(`Cloning ${projectName}: ${sourceUrl} -> ${projectPath}`);

  fs.mkdirSync(path.dirname(projectPath), { recursive: true });
  runCommand('git', ['clone', sourceUrl, projectPath]);

  checkoutBranch(projectPath, sourceBranch);
  git(projectPath, ['pull', '--ff-only', 'origin', sourceBranch]);
}

function syncProject(workspaceRoot, projectName, projectConfig) {
  ensureProjectConfig(projectName, projectConfig);

  const sourcePath = path.resolve(workspaceRoot, projectConfig.sourcePath);
  const sourceUrl = projectConfig.sourceUrl;
  const sourceBranch = projectConfig.sourceBranch;

  return withSourceRepoLock(workspaceRoot, sourcePath, `source repo ${projectName}`, () => {
    if (fs.existsSync(sourcePath)) {
      const gitPath = path.join(sourcePath, '.git');
      if (!fs.existsSync(gitPath)) {
        throw new Error(`Path exists but is not a Git repository for ${projectName}: ${sourcePath}`);
      }

      updateExistingRepo(projectName, sourcePath, sourceUrl, sourceBranch);
      return;
    }

    cloneRepo(projectName, sourcePath, sourceUrl, sourceBranch);
  });
}

function main() {
  const workspaceRoot = requireWorkspaceRoot(process.cwd());
  const config = loadProjectsConfig(workspaceRoot);

  const entries = Object.entries(config.projects || {});
  if (entries.length === 0) {
    console.log('No projects configured in config/projects.json');
    return;
  }

  for (const [projectName, projectConfig] of entries) {
    syncProject(workspaceRoot, projectName, projectConfig);
  }

  console.log('All configured source repositories are ready.');
}

try {
  main();
} catch (error) {
  printCliError(error);
  process.exit(1);
}
