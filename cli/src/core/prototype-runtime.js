import { getProjectConfig, normalizeCommand } from './config.js';

export function isTemplatePrototype(meta) {
  return meta?.origin?.kind === 'template' || typeof meta?.createdFrom?.templateKey === 'string';
}

export function isSyncEnabled(meta) {
  if (typeof meta?.capabilities?.sync === 'boolean') {
    return meta.capabilities.sync;
  }

  return !isTemplatePrototype(meta);
}

export function displaySource(meta) {
  if (isTemplatePrototype(meta)) {
    return meta?.origin?.label || meta?.createdFrom?.templateKey || 'template';
  }

  return meta?.sourceProject || 'unknown';
}

export function loadPrototypeRuntime(workspaceRoot, meta) {
  if (isTemplatePrototype(meta)) {
    return {
      kind: 'template',
      label: displaySource(meta),
      devCommand: normalizeCommand(meta?.commands?.devCommand, 'meta.commands.devCommand'),
      installCommand: normalizeCommand(meta?.commands?.installCommand, 'meta.commands.installCommand'),
      mock: {
        enabled: Boolean(meta?.mock?.enabled)
      },
      syncEnabled: isSyncEnabled(meta)
    };
  }

  const projectConfig = getProjectConfig(workspaceRoot, meta.sourceProject);
  return {
    kind: 'project',
    label: meta.sourceProject,
    projectConfig,
    devCommand: normalizeCommand(projectConfig.devCommand, 'devCommand'),
    installCommand: normalizeCommand(projectConfig.installCommand, 'installCommand'),
    mock: {
      enabled: Boolean(projectConfig.mock?.enabled)
    },
    syncEnabled: true
  };
}
