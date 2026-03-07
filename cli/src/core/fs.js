import fs from 'node:fs';
import path from 'node:path';

export function exists(filePath) {
  return fs.existsSync(filePath);
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function removeIfExists(targetPath) {
  if (!exists(targetPath)) {
    return;
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
}

export function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function copyDirFiltered(sourceDir, destinationDir, options = {}) {
  const { excludeNames = new Set() } = options;

  if (!exists(sourceDir)) {
    throw new Error(`Source path does not exist: ${sourceDir}`);
  }

  ensureDir(destinationDir);

  fs.cpSync(sourceDir, destinationDir, {
    recursive: true,
    force: true,
    filter: (currentPath) => {
      const name = path.basename(currentPath);
      return !excludeNames.has(name);
    }
  });
}

export function replaceDirectoryContents(targetDir, sourceDir, options = {}) {
  const {
    preserveTargetNames = new Set(),
    excludeSourceNames = new Set()
  } = options;

  ensureDir(targetDir);

  for (const entry of fs.readdirSync(targetDir)) {
    if (preserveTargetNames.has(entry)) {
      continue;
    }
    removeIfExists(path.join(targetDir, entry));
  }

  for (const entry of fs.readdirSync(sourceDir)) {
    if (excludeSourceNames.has(entry)) {
      continue;
    }
    const sourcePath = path.join(sourceDir, entry);
    const destinationPath = path.join(targetDir, entry);
    fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true });
  }
}

export function listDirectories(dirPath) {
  if (!exists(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath)
    .filter((entry) => fs.statSync(path.join(dirPath, entry)).isDirectory());
}
