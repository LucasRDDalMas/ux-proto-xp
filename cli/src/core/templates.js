import path from 'node:path';
import { exists, readJson } from './fs.js';
import { normalizeCommand } from './config.js';

export function templatesConfigPath(workspaceRoot) {
  return path.join(workspaceRoot, 'templates', 'index.json');
}

export function loadTemplatesConfig(workspaceRoot) {
  const filePath = templatesConfigPath(workspaceRoot);
  if (!exists(filePath)) {
    throw new Error(`Missing template registry: ${filePath}`);
  }

  const parsed = readJson(filePath);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.templates !== 'object') {
    throw new Error('Invalid templates/index.json format. Expected { "templates": { ... } }.');
  }

  return parsed;
}

export function getTemplateConfig(workspaceRoot, templateKey) {
  const config = loadTemplatesConfig(workspaceRoot);
  const template = config.templates[templateKey];
  if (!template) {
    throw new Error(`Template "${templateKey}" is not defined in templates/index.json.`);
  }

  const required = ['label', 'path', 'installCommand', 'devCommand'];
  for (const key of required) {
    if (!(key in template)) {
      throw new Error(`Template "${templateKey}" is missing required key "${key}".`);
    }
  }

  return {
    label: template.label,
    path: template.path,
    appPath: template.appPath || '.',
    projectName: template.projectName || 'templates',
    installCommand: normalizeCommand(template.installCommand, `template ${templateKey} installCommand`),
    devCommand: normalizeCommand(template.devCommand, `template ${templateKey} devCommand`),
    mock: {
      enabled: Boolean(template.mock?.enabled)
    },
    sync: Boolean(template.sync)
  };
}

export function resolveTemplatePaths(workspaceRoot, templateConfig) {
  const templateRoot = path.resolve(workspaceRoot, templateConfig.path);
  const templateAppPath = path.join(templateRoot, templateConfig.appPath);

  if (!exists(templateRoot)) {
    throw new Error(`Template path does not exist: ${templateRoot}`);
  }

  if (!exists(templateAppPath)) {
    throw new Error(`Configured template appPath does not exist: ${templateAppPath}`);
  }

  return {
    templateRoot,
    templateAppPath
  };
}
