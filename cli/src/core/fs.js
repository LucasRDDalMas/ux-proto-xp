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
    excludeSourceNames = new Set(),
    preserveRelativePaths = new Set()
  } = options;

  ensureDir(targetDir);

  function hasPreservedDescendant(relativePath) {
    for (const preservedPath of preserveRelativePaths) {
      if (
        preservedPath === relativePath ||
        preservedPath.startsWith(`${relativePath}${path.sep}`)
      ) {
        return true;
      }
    }
    return false;
  }

  function cleanTargetDirectory(currentDir, relativeDir = '') {
    for (const entry of fs.readdirSync(currentDir)) {
      const absolutePath = path.join(currentDir, entry);
      const relativePath = relativeDir ? path.join(relativeDir, entry) : entry;

      if (preserveTargetNames.has(entry) && relativeDir === '') {
        continue;
      }

      if (preserveRelativePaths.has(relativePath)) {
        continue;
      }

      if (hasPreservedDescendant(relativePath) && fs.statSync(absolutePath).isDirectory()) {
        cleanTargetDirectory(absolutePath, relativePath);
        continue;
      }

      removeIfExists(absolutePath);
    }
  }

  cleanTargetDirectory(targetDir);

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
