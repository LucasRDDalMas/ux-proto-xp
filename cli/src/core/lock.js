import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir, exists, readJson, removeIfExists, writeJson } from './fs.js';

export class LockError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'LockError';
    this.details = details;
  }
}

function locksRoot(workspaceRoot) {
  return path.join(workspaceRoot, '.ux-proto', 'locks');
}

function hashKey(scope, resourcePath) {
  return crypto
    .createHash('sha1')
    .update(`${scope}:${path.resolve(resourcePath)}`)
    .digest('hex')
    .slice(0, 16);
}

function lockDirPath(workspaceRoot, scope, resourcePath) {
  return path.join(locksRoot(workspaceRoot), `${scope}-${hashKey(scope, resourcePath)}.lock`);
}

function lockInfoPath(lockPath) {
  return path.join(lockPath, 'info.json');
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && error.code === 'ESRCH') {
      return false;
    }
    return true;
  }
}

function readLockInfo(lockPath) {
  const infoPath = lockInfoPath(lockPath);
  if (!exists(infoPath)) {
    return null;
  }

  try {
    return readJson(infoPath);
  } catch {
    return null;
  }
}

function isStaleLock(lockInfo) {
  if (!lockInfo || lockInfo.hostname !== os.hostname()) {
    return false;
  }

  if (!Number.isInteger(lockInfo.pid) || lockInfo.pid <= 0) {
    return false;
  }

  return !processExists(lockInfo.pid);
}

function lockHolderLabel(lockInfo) {
  if (!lockInfo) {
    return 'unknown holder';
  }

  const parts = [];
  if (Number.isInteger(lockInfo.pid) && lockInfo.pid > 0) {
    parts.push(`pid ${lockInfo.pid}`);
  }
  if (typeof lockInfo.hostname === 'string' && lockInfo.hostname.length > 0) {
    parts.push(`host ${lockInfo.hostname}`);
  }
  if (typeof lockInfo.acquiredAt === 'string' && lockInfo.acquiredAt.length > 0) {
    parts.push(`since ${lockInfo.acquiredAt}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'unknown holder';
}

function buildLockInfo(scope, resourcePath, label) {
  return {
    scope,
    resourcePath: path.resolve(resourcePath),
    label,
    pid: process.pid,
    hostname: os.hostname(),
    acquiredAt: new Date().toISOString(),
    cwd: process.cwd()
  };
}

function acquireLock(workspaceRoot, scope, resourcePath, label) {
  const root = locksRoot(workspaceRoot);
  const lockPath = lockDirPath(workspaceRoot, scope, resourcePath);
  ensureDir(root);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.mkdirSync(lockPath);
      try {
        writeJson(lockInfoPath(lockPath), buildLockInfo(scope, resourcePath, label));
      } catch (error) {
        removeIfExists(lockPath);
        throw error;
      }
      return lockPath;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }

      const existing = readLockInfo(lockPath);
      if (isStaleLock(existing)) {
        removeIfExists(lockPath);
        continue;
      }

      const message = `Another ux-proto operation is already running for ${label} (${lockHolderLabel(existing)}).`;
      throw new LockError(message, {
        scope,
        resourcePath: path.resolve(resourcePath),
        lockPath,
        holder: existing
      });
    }
  }

  throw new LockError(`Failed to acquire lock for ${label}.`, {
    scope,
    resourcePath: path.resolve(resourcePath),
    lockPath
  });
}

function releaseLock(lockPath) {
  removeIfExists(lockPath);
}

export function withLock(workspaceRoot, scope, resourcePath, label, fn) {
  const lockPath = acquireLock(workspaceRoot, scope, resourcePath, label);
  try {
    return fn();
  } finally {
    releaseLock(lockPath);
  }
}

export function withPrototypeLock(workspaceRoot, prototypeRoot, label, fn) {
  return withLock(workspaceRoot, 'prototype', prototypeRoot, label, fn);
}

export function withSourceRepoLock(workspaceRoot, sourceRepoPath, label, fn) {
  return withLock(workspaceRoot, 'source', sourceRepoPath, label, fn);
}
