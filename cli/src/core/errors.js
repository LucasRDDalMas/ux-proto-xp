function trimOutput(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

export function renderCliError(error) {
  if (!error) {
    return 'Error: unknown failure';
  }

  const lines = [`Error: ${error.message || 'unknown failure'}`];
  const details = error.details && typeof error.details === 'object' ? error.details : null;

  if (details?.command) {
    const args = Array.isArray(details.args) ? details.args.join(' ') : '';
    lines.push(`Command: ${details.command}${args ? ` ${args}` : ''}`);
  }

  if (details?.cwd) {
    lines.push(`Working directory: ${details.cwd}`);
  }

  if (details?.exitCode !== undefined && details.exitCode !== null) {
    lines.push(`Exit code: ${details.exitCode}`);
  }

  if (details?.signal) {
    lines.push(`Signal: ${details.signal}`);
  }

  if (details?.lockPath) {
    lines.push(`Lock path: ${details.lockPath}`);
  }

  const stderr = trimOutput(details?.stderr);
  const stdout = trimOutput(details?.stdout);

  if (stderr) {
    lines.push('stderr:');
    lines.push(stderr);
  } else if (stdout) {
    lines.push('stdout:');
    lines.push(stdout);
  }

  return lines.join('\n');
}

export function printCliError(error) {
  console.error(renderCliError(error));
}
