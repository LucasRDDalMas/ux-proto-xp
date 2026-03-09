const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function findWorkspaceRoot(startPath) {
  if (!startPath) {
    return null;
  }

  let current = path.resolve(startPath);
  while (true) {
    const marker = path.join(current, '.ux-proto', 'workspace.json');
    if (fs.existsSync(marker)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function getWorkspaceRoot() {
  const folders = vscode.workspace.workspaceFolders || [];
  for (const folder of folders) {
    const candidate = findWorkspaceRoot(folder.uri.fsPath);
    if (candidate) {
      return candidate;
    }
  }

  const activeFile = vscode.window.activeTextEditor?.document?.uri?.fsPath;
  return findWorkspaceRoot(activeFile || process.cwd());
}

function getConfig() {
  return vscode.workspace.getConfiguration('uxProto');
}

function terminalBaseName() {
  return getConfig().get('terminalName', 'ux-proto');
}

function createTerminal(rootPath, label, cwdPath = rootPath) {
  const base = terminalBaseName();
  const name = label ? `${base}: ${label}` : base;
  return vscode.window.createTerminal({
    name,
    cwd: cwdPath
  });
}

function wrapAutoClose(command) {
  return `${command}; cmd_status=$?; if [ $cmd_status -eq 0 ]; then exit 0; else echo "[ux-proto] command failed with exit $cmd_status"; fi`;
}

function resolveCliCommand(rootPath) {
  const cliCommand = getConfig().get('cliCommand', 'node cli/src/index.js').trim();
  if (!cliCommand) {
    throw new Error('uxProto.cliCommand cannot be empty.');
  }

  const relativeCliPath = 'cli/src/index.js';
  if (!cliCommand.includes(relativeCliPath)) {
    return cliCommand;
  }

  return cliCommand.replace(relativeCliPath, shellQuote(path.join(rootPath, relativeCliPath)));
}

function runCommand(rootPath, cwdPath, args, label = args[0] || 'proto', options = {}) {
  const { persistent = false } = options;
  const cliCommand = resolveCliCommand(rootPath);
  const terminal = createTerminal(rootPath, label, cwdPath);
  const command = `${cliCommand} ${args.map(shellQuote).join(' ')}`;

  terminal.show(true);
  terminal.sendText(persistent ? command : wrapAutoClose(command));
}

function runRawCommand(rootPath, command, label = 'command', options = {}) {
  const { persistent = false } = options;
  const terminal = createTerminal(rootPath, label, rootPath);
  terminal.show(true);
  terminal.sendText(persistent ? command : wrapAutoClose(command));
}

function runTerminalCommand(rootPath, cwdPath, command, label = 'shell', options = {}) {
  const { persistent = true } = options;
  const terminal = createTerminal(rootPath, label, cwdPath);
  terminal.show(true);
  terminal.sendText(persistent ? command : wrapAutoClose(command));
}

function saveWorkspaceState(rootPath) {
  runRawCommand(
    rootPath,
    "git add -A && (git diff --cached --quiet && echo 'No workspace changes to save.' || (git commit -m 'chore: checkpoint ux-proto workspace state' && git push))",
    'save-state'
  );
}

function readProjects(rootPath) {
  const projectsPath = path.join(rootPath, 'config', 'projects.json');
  if (!fs.existsSync(projectsPath)) {
    throw new Error(`Missing config/projects.json at ${projectsPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const projects = parsed.projects || {};
  return Object.keys(projects);
}

function readTemplates(rootPath) {
  const templatesPath = path.join(rootPath, 'templates', 'index.json');
  if (!fs.existsSync(templatesPath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
  const templates = parsed.templates || {};

  return Object.entries(templates)
    .map(([key, template]) => ({
      key,
      label: template.label || key,
      projectName: template.projectName || 'templates',
      sync: Boolean(template.sync)
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function readProjectsConfig(rootPath) {
  const projectsPath = path.join(rootPath, 'config', 'projects.json');
  if (!fs.existsSync(projectsPath)) {
    throw new Error(`Missing config/projects.json at ${projectsPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  if (!parsed.projects || typeof parsed.projects !== 'object') {
    parsed.projects = {};
  }

  return {
    projectsPath,
    parsed
  };
}

function writeProjectsConfig(projectsPath, parsed) {
  fs.writeFileSync(projectsPath, `${JSON.stringify(parsed, null, 2)}\n`);
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function deriveSourcePath(projectName) {
  return `projects/${projectName}-repo`;
}

function tokenizeCommand(commandText) {
  const input = String(commandText || '').trim();
  if (!input) {
    throw new Error('Command cannot be empty.');
  }

  const tokens = [];
  let current = '';
  let quote = null;
  let escapeNext = false;

  for (const char of input) {
    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && quote !== '\'') {
      escapeNext = true;
      continue;
    }

    if (char === '\'' || char === '"') {
      if (!quote) {
        quote = char;
        continue;
      }

      if (quote === char) {
        quote = null;
        continue;
      }
    }

    if (!quote && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escapeNext || quote) {
    throw new Error('Command has an unfinished quote or escape sequence.');
  }

  if (current) {
    tokens.push(current);
  }

  if (tokens.length === 0) {
    throw new Error('Command cannot be empty.');
  }

  return tokens;
}

function formatVersion(version) {
  if (Number.isInteger(version) && version >= 0) {
    return `v${version}`;
  }

  return 'initializing';
}

function isTemplatePrototypeMeta(meta) {
  return meta?.origin?.kind === 'template' || typeof meta?.createdFrom?.templateKey === 'string';
}

function syncEnabledForMeta(meta) {
  if (typeof meta?.capabilities?.sync === 'boolean') {
    return meta.capabilities.sync;
  }

  return !isTemplatePrototypeMeta(meta);
}

function formatPrototypeSource(meta) {
  if (isTemplatePrototypeMeta(meta)) {
    return meta?.origin?.label || meta?.createdFrom?.templateKey || 'template';
  }

  return meta?.lastSyncedSourceCommit ? meta.lastSyncedSourceCommit.slice(0, 7) : 'unknown';
}

function displayProjectGroupName(projectName) {
  return projectName === 'templates' ? 'Templates' : projectName;
}

function listPrototypes(rootPath) {
  const prototypesRoot = path.join(rootPath, 'prototypes');
  if (!fs.existsSync(prototypesRoot)) {
    return [];
  }

  const items = [];
  for (const projectName of fs.readdirSync(prototypesRoot)) {
    const projectRoot = path.join(prototypesRoot, projectName);
    if (!fs.statSync(projectRoot).isDirectory()) {
      continue;
    }

    for (const prototypeName of fs.readdirSync(projectRoot)) {
      const prototypeRoot = path.join(projectRoot, prototypeName);
      if (!fs.statSync(prototypeRoot).isDirectory()) {
        continue;
      }

      const metaPath = path.join(prototypeRoot, '.uxproto', 'meta.json');
      if (!fs.existsSync(metaPath)) {
        continue;
      }

      const meta = safeReadJson(metaPath) || {};
      items.push({
        projectName,
        prototypeName,
        prototypeRoot,
        label: `${projectName}/${prototypeName}`,
        version: meta.versioning?.currentVersion,
        status: meta.status || 'active',
        sourceCommit: meta.lastSyncedSourceCommit || '',
        sourceLabel: formatPrototypeSource(meta),
        syncEnabled: syncEnabledForMeta(meta),
        sourceKind: isTemplatePrototypeMeta(meta) ? 'template' : 'project'
      });
    }
  }

  return items.sort((a, b) => a.label.localeCompare(b.label));
}

function listVersionsForPrototype(prototype) {
  const versionsPath = path.join(prototype.prototypeRoot, '.uxproto', 'versions', 'index.json');
  const metaPath = path.join(prototype.prototypeRoot, '.uxproto', 'meta.json');

  if (!fs.existsSync(versionsPath)) {
    return [];
  }

  const parsed = safeReadJson(versionsPath) || {};
  const versions = Array.isArray(parsed.versions) ? parsed.versions : [];
  const meta = safeReadJson(metaPath) || {};
  const currentVersion = meta.versioning?.currentVersion;

  return [...versions]
    .reverse()
    .map((entry) => ({
      prototype,
      number: entry.number,
      comment: entry.comment || '',
      commit: entry.commit || '',
      isCurrent: entry.number === currentVersion
    }));
}

function groupPrototypesByProject(rootPath) {
  const prototypes = listPrototypes(rootPath);
  const groups = new Map();

  for (const prototype of prototypes) {
    if (!groups.has(prototype.projectName)) {
      groups.set(prototype.projectName, []);
    }
    groups.get(prototype.projectName).push(prototype);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([projectName, prototypes]) => ({
      projectName,
      prototypes
    }));
}

function normalizePrototypeArgument(rootPath, maybePrototype) {
  const target = maybePrototype?.prototype || maybePrototype;
  if (!target || typeof target !== 'object') {
    return null;
  }

  let projectName = target.projectName;
  let prototypeName = target.prototypeName;
  let prototypeRoot = target.prototypeRoot;

  if (!prototypeRoot && projectName && prototypeName) {
    prototypeRoot = path.join(rootPath, 'prototypes', projectName, prototypeName);
  }

  if (!prototypeRoot || !fs.existsSync(path.join(prototypeRoot, '.uxproto', 'meta.json'))) {
    return null;
  }

  if (!projectName || !prototypeName) {
    const rel = path.relative(path.join(rootPath, 'prototypes'), prototypeRoot);
    const parts = rel.split(path.sep);
    projectName = parts[0];
    prototypeName = parts[1];
  }

  return {
    projectName,
    prototypeName,
    prototypeRoot,
    label: `${projectName}/${prototypeName}`
  };
}

async function pickProject(rootPath) {
  const projects = readProjects(rootPath);
  if (projects.length === 0) {
    vscode.window.showErrorMessage('No projects configured in config/projects.json.');
    return null;
  }

  return vscode.window.showQuickPick(projects, {
    placeHolder: 'Select a source project'
  });
}

async function pickTemplate(rootPath) {
  const templates = readTemplates(rootPath);
  if (templates.length === 0) {
    vscode.window.showErrorMessage('No templates configured in templates/index.json.');
    return null;
  }

  const selected = await vscode.window.showQuickPick(
    templates.map((template) => ({
      label: template.label,
      description: template.sync ? 'sync enabled' : 'no sync',
      detail: template.key,
      item: template
    })),
    {
      placeHolder: 'Select a built-in template'
    }
  );

  return selected?.item || null;
}

async function pickPrototype(rootPath, placeHolder = 'Select a prototype') {
  const prototypes = listPrototypes(rootPath);
  if (prototypes.length === 0) {
    vscode.window.showErrorMessage('No prototypes found in this workspace.');
    return null;
  }

  const selected = await vscode.window.showQuickPick(
    prototypes.map((item) => ({
      label: item.label,
      description: `${formatVersion(item.version)} • ${item.status}`,
      detail: path.relative(rootPath, item.prototypeRoot),
      item
    })),
    { placeHolder }
  );

  return selected?.item || null;
}

async function resolvePrototype(rootPath, maybePrototype, placeHolder) {
  const normalized = normalizePrototypeArgument(rootPath, maybePrototype);
  if (normalized) {
    return normalized;
  }
  return pickPrototype(rootPath, placeHolder);
}

async function promptForOnboarding(rootPath) {
  const { parsed } = readProjectsConfig(rootPath);
  const existingProjects = parsed.projects;

  const projectName = await vscode.window.showInputBox({
    title: 'Onboard Repository',
    prompt: 'Project key used by proto commands',
    placeHolder: 'e.g. checkout-app',
    validateInput: (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return 'Project key is required.';
      }
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) {
        return 'Use letters, numbers, and hyphens only.';
      }
      if (existingProjects[trimmed]) {
        return `Project "${trimmed}" already exists.`;
      }
      return null;
    }
  });

  if (!projectName) {
    return null;
  }

  const sourceUrl = await vscode.window.showInputBox({
    title: 'Onboard Repository',
    prompt: 'Git repository URL',
    placeHolder: 'https://github.com/org/repo.git',
    validateInput: (value) => value.trim() ? null : 'Repository URL is required.'
  });

  if (!sourceUrl) {
    return null;
  }

  const defaultSourcePath = deriveSourcePath(projectName.trim());
  const sourcePath = await vscode.window.showInputBox({
    title: 'Onboard Repository',
    prompt: 'Local source path relative to workspace root',
    value: defaultSourcePath,
    validateInput: (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return 'Source path is required.';
      }
      if (path.isAbsolute(trimmed) || trimmed.includes('..')) {
        return 'Use a relative path inside this workspace.';
      }
      return null;
    }
  });

  if (!sourcePath) {
    return null;
  }

  const sourceBranch = await vscode.window.showInputBox({
    title: 'Onboard Repository',
    prompt: 'Default source branch',
    value: 'main',
    validateInput: (value) => value.trim() ? null : 'Branch is required.'
  });

  if (!sourceBranch) {
    return null;
  }

  const appPath = await vscode.window.showInputBox({
    title: 'Onboard Repository',
    prompt: 'App path inside the repository',
    value: '.',
    validateInput: (value) => value.trim() ? null : 'App path is required.'
  });

  if (!appPath) {
    return null;
  }

  const installCommandText = await vscode.window.showInputBox({
    title: 'Onboard Repository',
    prompt: 'Install command',
    value: 'pnpm install --ignore-scripts',
    validateInput: (value) => value.trim() ? null : 'Install command is required.'
  });

  if (!installCommandText) {
    return null;
  }

  const devCommandText = await vscode.window.showInputBox({
    title: 'Onboard Repository',
    prompt: 'Dev command',
    value: 'pnpm dev',
    validateInput: (value) => value.trim() ? null : 'Dev command is required.'
  });

  if (!devCommandText) {
    return null;
  }

  const mockChoice = await vscode.window.showQuickPick(
    [
      { label: 'Disabled', enabled: false },
      { label: 'Enabled', enabled: true }
    ],
    {
      title: 'Onboard Repository',
      placeHolder: 'Enable mock server support for this project?'
    }
  );

  if (!mockChoice) {
    return null;
  }

  return {
    projectName: projectName.trim(),
    config: {
      sourcePath: sourcePath.trim(),
      sourceUrl: sourceUrl.trim(),
      sourceBranch: sourceBranch.trim(),
      appPath: appPath.trim(),
      installCommand: tokenizeCommand(installCommandText),
      devCommand: tokenizeCommand(devCommandText),
      mock: {
        enabled: mockChoice.enabled
      }
    }
  };
}

function saveOnboardedProject(rootPath, onboarding) {
  const { projectsPath, parsed } = readProjectsConfig(rootPath);
  parsed.projects[onboarding.projectName] = onboarding.config;
  writeProjectsConfig(projectsPath, parsed);
}

function ensureRootOrThrow() {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) {
    throw new Error('ux-proto workspace root not found. Open the ux-proto workspace in VS Code.');
  }
  return rootPath;
}

class ProtoSidebarNode extends vscode.TreeItem {
  constructor(options) {
    super(options.label, options.collapsibleState ?? vscode.TreeItemCollapsibleState.None);
    this.nodeType = options.nodeType;
    this.projectName = options.projectName;
    this.prototype = options.prototype;
    this.versionNumber = options.versionNumber;
    this.versionEntry = options.versionEntry;
    this.description = options.description;
    this.tooltip = options.tooltip;
    this.command = options.command;
    this.iconPath = options.iconPath;
    this.contextValue = options.contextValue;
  }
}

class ProtoSidebarProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.refreshTimer = undefined;
  }

  refresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this._onDidChangeTreeData.fire();
  }

  scheduleRefresh(delayMs = 200) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      this._onDidChangeTreeData.fire();
    }, delayMs);
  }

  dispose() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this._onDidChangeTreeData.dispose();
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    const rootPath = getWorkspaceRoot();
    if (!rootPath) {
      return [
        new ProtoSidebarNode({
          nodeType: 'info',
          label: 'Open ux-proto workspace',
          description: 'workspace not found',
          iconPath: new vscode.ThemeIcon('warning')
        })
      ];
    }

    if (!element) {
      return [
        new ProtoSidebarNode({
          nodeType: 'section-actions',
          label: 'Actions',
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          iconPath: new vscode.ThemeIcon('tools')
        }),
        new ProtoSidebarNode({
          nodeType: 'section-prototypes',
          label: 'Prototypes',
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          iconPath: new vscode.ThemeIcon('folder-library')
        })
      ];
    }

    if (element.nodeType === 'section-actions') {
      return [
        this.createActionNode('Bootstrap Sources', 'uxProto.makeSources', undefined, 'cloud-download'),
        this.createActionNode('Save State', 'uxProto.saveState', undefined, 'cloud-upload'),
        this.createActionNode('Onboard Repository', 'uxProto.onboardRepository', undefined, 'repo-create'),
        this.createActionNode('Create Prototype', 'uxProto.create', undefined, 'add'),
        this.createActionNode('List Active', 'uxProto.list', undefined, 'list-tree'),
        this.createActionNode('List Archive', 'uxProto.listArchive', undefined, 'archive')
      ];
    }

    if (element.nodeType === 'section-prototypes') {
      const groups = groupPrototypesByProject(rootPath);
      if (groups.length === 0) {
        return [
          new ProtoSidebarNode({
            nodeType: 'info',
            label: 'No prototypes yet',
            description: 'Run Create Prototype',
            iconPath: new vscode.ThemeIcon('circle-slash')
          })
        ];
      }

      return groups.map((group) => {
        const activeCount = group.prototypes.length;
        return new ProtoSidebarNode({
          nodeType: 'project-group',
          label: displayProjectGroupName(group.projectName),
          description: `${activeCount} prototype${activeCount === 1 ? '' : 's'}`,
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          iconPath: new vscode.ThemeIcon('repo'),
          projectName: group.projectName
        });
      });
    }

    if (element.nodeType === 'project-group') {
      const groups = groupPrototypesByProject(rootPath);
      const group = groups.find((entry) => entry.projectName === element.projectName);
      if (!group) {
        return [];
      }

      return group.prototypes.map((prototype) => {
        return new ProtoSidebarNode({
          nodeType: 'prototype',
          label: prototype.prototypeName,
          description: `${formatVersion(prototype.version)} • ${prototype.status} • ${prototype.sourceLabel}`,
          tooltip: prototype.prototypeRoot,
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          iconPath: new vscode.ThemeIcon('folder'),
          prototype
        });
      });
    }

    if (element.nodeType === 'prototype') {
      const nodes = [
        this.createActionNode('Run', 'uxProto.run', element.prototype, 'play-circle'),
        this.createActionNode('Open Claude', 'uxProto.openClaude', element.prototype, 'comment-discussion'),
        this.createActionNode('Open Codex', 'uxProto.openCodex', element.prototype, 'terminal'),
        this.createActionNode('Save Version', 'uxProto.save', element.prototype, 'save'),
        new ProtoSidebarNode({
          nodeType: 'versions-group',
          label: 'Versions',
          description: formatVersion(element.prototype.version),
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          iconPath: new vscode.ThemeIcon('history'),
          prototype: element.prototype
        }),
        this.createActionNode('Archive', 'uxProto.archive', element.prototype, 'archive')
      ];

      if (element.prototype.syncEnabled) {
        nodes.splice(nodes.length - 1, 0, this.createActionNode('Sync', 'uxProto.sync', element.prototype, 'sync'));
      }

      return nodes;
    }

    if (element.nodeType === 'versions-group') {
      const versions = listVersionsForPrototype(element.prototype);
      if (versions.length === 0) {
        return [
          new ProtoSidebarNode({
            nodeType: 'info',
            label: 'No versions yet',
            description: 'Save the prototype to create history',
            iconPath: new vscode.ThemeIcon('circle-slash')
          })
        ];
      }

      return versions.map((entry) => {
        const descriptionParts = [];
        if (entry.isCurrent) {
          descriptionParts.push('current');
        }
        if (entry.comment) {
          descriptionParts.push(entry.comment);
        }

        return new ProtoSidebarNode({
          nodeType: 'version',
          label: `v${entry.number}`,
          description: descriptionParts.join(' • '),
          tooltip: entry.commit ? `commit ${entry.commit}` : undefined,
          iconPath: new vscode.ThemeIcon(entry.isCurrent ? 'circle-large-filled' : 'history'),
          contextValue: entry.isCurrent ? 'protoVersionCurrent' : 'protoVersionRollbackable',
          prototype: entry.prototype,
          versionNumber: entry.number,
          versionEntry: entry
        });
      });
    }

    return [];
  }

  createActionNode(label, command, argument, iconId) {
    return new ProtoSidebarNode({
      nodeType: 'action',
      label,
      iconPath: new vscode.ThemeIcon(iconId),
      command: {
        command,
        title: label,
        arguments: argument ? [argument] : []
      }
    });
  }
}

function registerFileWatcher(context, provider, rootPath, globPattern) {
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath, globPattern)
  );

  const schedule = () => provider.scheduleRefresh();
  context.subscriptions.push(
    watcher,
    watcher.onDidCreate(schedule),
    watcher.onDidChange(schedule),
    watcher.onDidDelete(schedule)
  );
}

function withCommandError(handler, provider, options = {}) {
  const { refreshAfter = true } = options;

  return async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      vscode.window.showErrorMessage(`Proto command failed: ${error.message}`);
    } finally {
      if (refreshAfter) {
        provider.refresh();
      }
    }
  };
}

function register(context, provider, commandId, handler, options = {}) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, withCommandError(handler, provider, options))
  );
}

function activate(context) {
  const sidebarProvider = new ProtoSidebarProvider();
  const treeView = vscode.window.createTreeView('uxProto.sidebar', {
    treeDataProvider: sidebarProvider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);
  context.subscriptions.push(sidebarProvider);
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('uxProto')) {
      sidebarProvider.refresh();
    }
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
    sidebarProvider.refresh();
  }));

  const rootPath = getWorkspaceRoot();
  if (rootPath) {
    registerFileWatcher(context, sidebarProvider, rootPath, 'config/projects.json');
    registerFileWatcher(context, sidebarProvider, rootPath, 'prototypes/**/.uxproto/meta.json');
    registerFileWatcher(context, sidebarProvider, rootPath, 'prototypes/**/.uxproto/versions/index.json');
    registerFileWatcher(context, sidebarProvider, rootPath, 'archive/**/.uxproto/meta.json');
  }

  register(context, sidebarProvider, 'uxProto.refreshSidebar', async () => {
    sidebarProvider.refresh();
  }, { refreshAfter: false });

  register(context, sidebarProvider, 'uxProto.makeSources', async () => {
    const rootPath = ensureRootOrThrow();
    runRawCommand(rootPath, 'make sources', 'bootstrap-sources');
  });

  register(context, sidebarProvider, 'uxProto.saveState', async () => {
    const rootPath = ensureRootOrThrow();
    saveWorkspaceState(rootPath);
  });

  register(context, sidebarProvider, 'uxProto.onboardRepository', async () => {
    const rootPath = ensureRootOrThrow();
    const onboarding = await promptForOnboarding(rootPath);
    if (!onboarding) {
      return;
    }

    const confirm = await vscode.window.showInformationMessage(
      `Add project "${onboarding.projectName}" to config/projects.json?`,
      { modal: true },
      'Add Project'
    );

    if (confirm !== 'Add Project') {
      return;
    }

    saveOnboardedProject(rootPath, onboarding);

    const bootstrapChoice = await vscode.window.showInformationMessage(
      `Project "${onboarding.projectName}" added. Clone or update sources now?`,
      'Run make sources',
      'Later'
    );

    if (bootstrapChoice === 'Run make sources') {
      runRawCommand(rootPath, 'make sources', 'bootstrap-sources');
    }
  });

  register(context, sidebarProvider, 'uxProto.create', async (projectArg) => {
    const rootPath = ensureRootOrThrow();
    let createMode = 'project';
    let project = typeof projectArg === 'string' ? projectArg : null;
    let template = null;

    if (!project) {
      const selectedMode = await vscode.window.showQuickPick([
        {
          label: 'Source project',
          description: 'Create a syncable prototype from a configured repository',
          mode: 'project'
        },
        {
          label: 'Built-in template',
          description: 'Create a local prototype with no sync',
          mode: 'template'
        }
      ], {
        title: 'Create Prototype',
        placeHolder: 'Choose how to create the prototype'
      });

      if (!selectedMode) {
        return;
      }

      createMode = selectedMode.mode;
      if (createMode === 'project') {
        project = await pickProject(rootPath);
        if (!project) {
          return;
        }
      } else {
        template = await pickTemplate(rootPath);
        if (!template) {
          return;
        }
      }
    }

    const prototypeName = await vscode.window.showInputBox({
      title: 'Create Prototype',
      prompt: 'Prototype name',
      placeHolder: 'e.g. onboarding-flow',
      validateInput: (value) => {
        if (!value || !value.trim()) {
          return 'Prototype name is required.';
        }
        if (/[/\\]/.test(value)) {
          return 'Prototype name cannot contain path separators.';
        }
        return null;
      }
    });

    if (!prototypeName) {
      return;
    }

    if (createMode === 'template') {
      runCommand(
        rootPath,
        rootPath,
        ['create', '--template', template.key, prototypeName.trim()],
        `create ${template.key}/${prototypeName.trim()}`
      );
      return;
    }

    runCommand(rootPath, rootPath, ['create', project, prototypeName.trim()], `create ${project}/${prototypeName.trim()}`);
  });

  register(context, sidebarProvider, 'uxProto.save', async (prototypeArg) => {
    const rootPath = ensureRootOrThrow();
    const prototype = await resolvePrototype(rootPath, prototypeArg, 'Select prototype to save');
    if (!prototype) {
      return;
    }

    const comment = await vscode.window.showInputBox({
      title: 'Save Version',
      prompt: 'Optional version comment',
      placeHolder: 'Leave empty for no comment'
    });

    const args = ['save'];
    if (comment && comment.trim().length > 0) {
      args.push('--comment', comment.trim());
    }

    runCommand(rootPath, prototype.prototypeRoot, args, `save ${prototype.prototypeName}`);
  });

  register(context, sidebarProvider, 'uxProto.rollbackToVersion', async (versionArg) => {
    const rootPath = ensureRootOrThrow();
    const prototype = normalizePrototypeArgument(rootPath, versionArg);
    const versionNumber = versionArg?.versionNumber ?? versionArg?.versionEntry?.number;

    if (!prototype || !Number.isInteger(versionNumber)) {
      throw new Error('Version selection is invalid.');
    }

    const confirm = await vscode.window.showWarningMessage(
      `Rollback ${prototype.label} to v${versionNumber}?`,
      { modal: true },
      'Rollback'
    );
    if (confirm !== 'Rollback') {
      return;
    }

    runCommand(rootPath, prototype.prototypeRoot, ['rollback', String(versionNumber)], `rollback ${prototype.prototypeName}`);
  });

  register(context, sidebarProvider, 'uxProto.list', async () => {
    const rootPath = ensureRootOrThrow();
    runCommand(rootPath, rootPath, ['list'], 'list');
  });

  register(context, sidebarProvider, 'uxProto.listArchive', async () => {
    const rootPath = ensureRootOrThrow();
    runCommand(rootPath, rootPath, ['list', 'archive'], 'list archive');
  });

  register(context, sidebarProvider, 'uxProto.run', async (prototypeArg) => {
    const rootPath = ensureRootOrThrow();
    const prototype = await resolvePrototype(rootPath, prototypeArg, 'Select prototype to run');
    if (!prototype) {
      return;
    }

    runCommand(rootPath, prototype.prototypeRoot, ['run'], `run ${prototype.prototypeName}`, { persistent: true });
  });

  register(context, sidebarProvider, 'uxProto.openClaude', async (prototypeArg) => {
    const rootPath = ensureRootOrThrow();
    const prototype = await resolvePrototype(rootPath, prototypeArg, 'Select prototype to open in Claude');
    if (!prototype) {
      return;
    }

    runTerminalCommand(rootPath, prototype.prototypeRoot, 'claude', `claude ${prototype.prototypeName}`, { persistent: true });
  });

  register(context, sidebarProvider, 'uxProto.openCodex', async (prototypeArg) => {
    const rootPath = ensureRootOrThrow();
    const prototype = await resolvePrototype(rootPath, prototypeArg, 'Select prototype to open in Codex');
    if (!prototype) {
      return;
    }

    runTerminalCommand(rootPath, prototype.prototypeRoot, 'codex', `codex ${prototype.prototypeName}`, { persistent: true });
  });

  register(context, sidebarProvider, 'uxProto.sync', async (prototypeArg) => {
    const rootPath = ensureRootOrThrow();
    const prototype = await resolvePrototype(rootPath, prototypeArg, 'Select prototype to sync');
    if (!prototype) {
      return;
    }

    runCommand(rootPath, prototype.prototypeRoot, ['sync'], `sync ${prototype.prototypeName}`);
  });

  register(context, sidebarProvider, 'uxProto.archive', async (prototypeArg) => {
    const rootPath = ensureRootOrThrow();
    const prototype = await resolvePrototype(rootPath, prototypeArg, 'Select prototype to archive');
    if (!prototype) {
      return;
    }

    const action = await vscode.window.showQuickPick([
      { label: 'Archive (require clean)', args: ['archive'] },
      { label: 'Archive with --save', args: ['archive', '--save'] }
    ], {
      placeHolder: `Archive mode for ${prototype.label}`
    });

    if (!action) {
      return;
    }

    runCommand(rootPath, prototype.prototypeRoot, action.args, `archive ${prototype.prototypeName}`);
  });
}

function deactivate() {
}

module.exports = {
  activate,
  deactivate
};
