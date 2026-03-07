import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { getProjectConfig, normalizeCommand } from '../core/config.js';
import { loadMeta, requirePrototypeContext } from '../core/prototype.js';

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

function terminateProcess(child) {
  if (!child || child.killed) {
    return;
  }
  child.kill('SIGTERM');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkMockHealth(port) {
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: '/health',
      method: 'GET',
      timeout: 500
    }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function waitForMockReady(mockProcess, port, timeoutMs = 6000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (mockProcess.exitCode !== null) {
      throw new Error(`mock companion server exited early with code ${mockProcess.exitCode}`);
    }

    const healthy = await checkMockHealth(port);
    if (healthy) {
      return;
    }

    await delay(150);
  }

  throw new Error(`mock companion server did not become healthy within ${timeoutMs}ms`);
}

export async function runCommandHandler() {
  const context = requirePrototypeContext(process.cwd());
  const meta = loadMeta(context.metaPath);
  const projectConfig = getProjectConfig(context.workspaceRoot, meta.sourceProject);
  const devCommand = normalizeCommand(projectConfig.devCommand, 'devCommand');

  let mockProcess = null;
  const mockPort = Number.parseInt(process.env.UXPROTO_MOCK_PORT || '4010', 10);
  if (!Number.isInteger(mockPort) || mockPort <= 0 || mockPort > 65535) {
    throw new Error(`Invalid UXPROTO_MOCK_PORT value: ${process.env.UXPROTO_MOCK_PORT || '4010'}`);
  }

  if (meta.mock?.enabled) {
    const mockScript = path.join(context.workspaceRoot, 'cli', 'src', 'runtime', 'mock-server.js');

    mockProcess = spawn(process.execPath, [mockScript, context.prototypeRoot, String(mockPort)], {
      stdio: 'inherit',
      cwd: context.prototypeRoot
    });

    try {
      await waitForMockReady(mockProcess, mockPort);
    } catch (error) {
      terminateProcess(mockProcess);
      throw new Error(`Mock startup failed: ${error.message}`);
    }
  }

  const devProcess = spawn(devCommand[0], devCommand.slice(1), {
    stdio: 'inherit',
    cwd: context.prototypeRoot,
    env: {
      ...process.env,
      UXPROTO_MOCK_URL: `http://127.0.0.1:${process.env.UXPROTO_MOCK_PORT || '4010'}`
    }
  });

  const shutdown = () => {
    terminateProcess(devProcess);
    terminateProcess(mockProcess);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const devExit = await waitForExit(devProcess);
  terminateProcess(mockProcess);

  if (devExit.signal) {
    process.exitCode = 1;
    return;
  }

  process.exitCode = devExit.code ?? 1;
}
