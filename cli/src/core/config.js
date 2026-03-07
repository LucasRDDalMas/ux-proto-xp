import path from 'node:path';
import { exists, readJson } from './fs.js';

export function projectsConfigPath(workspaceRoot) {
  return path.join(workspaceRoot, 'config', 'projects.json');
}

export function loadProjectsConfig(workspaceRoot) {
  const filePath = projectsConfigPath(workspaceRoot);
  if (!exists(filePath)) {
    throw new Error(`Missing config file: ${filePath}`);
  }

  const parsed = readJson(filePath);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.projects !== 'object') {
    throw new Error('Invalid config/projects.json format. Expected { "projects": { ... } }.');
  }

  return parsed;
}

export function getProjectConfig(workspaceRoot, projectName) {
  const config = loadProjectsConfig(workspaceRoot);
  const project = config.projects[projectName];
  if (!project) {
    throw new Error(`Project "${projectName}" is not onboarded in config/projects.json.`);
  }

  const required = ['sourcePath', 'sourceUrl', 'sourceBranch', 'appPath', 'installCommand', 'devCommand'];
  for (const key of required) {
    if (!(key in project)) {
      throw new Error(`Project "${projectName}" is missing required key "${key}".`);
    }
  }

  return project;
}

export function normalizeCommand(commandValue, label) {
  if (Array.isArray(commandValue) && commandValue.length > 0 && commandValue.every((item) => typeof item === 'string')) {
    return commandValue;
  }

  throw new Error(`${label} must be an argv array in config/projects.json (e.g. ["npm", "run", "dev"]).`);
}
