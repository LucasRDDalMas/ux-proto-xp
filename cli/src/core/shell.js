import { spawnSync } from 'node:child_process';

export class CommandError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CommandError';
    this.details = details;
  }
}

export function runCommand(command, args = [], options = {}) {
  const {
    cwd,
    env,
    allowFailure = false,
    stdio = 'pipe'
  } = options;

  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio
  });

  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  const exitCode = result.status ?? 1;

  if (result.error) {
    throw new CommandError(`Failed to execute ${command}: ${result.error.message}`, {
      command,
      args,
      cwd,
      error: result.error
    });
  }

  if (exitCode !== 0 && !allowFailure) {
    throw new CommandError(
      `Command failed: ${command} ${args.join(' ')}`,
      {
        command,
        args,
        cwd,
        exitCode,
        stdout,
        stderr
      }
    );
  }

  return {
    command,
    args,
    cwd,
    exitCode,
    stdout,
    stderr
  };
}
