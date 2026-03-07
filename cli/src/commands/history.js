import { requirePrototypeContext, loadVersions } from '../core/prototype.js';

export function historyCommand() {
  const context = requirePrototypeContext(process.cwd());
  const versionsData = loadVersions(context.versionsPath);

  if (versionsData.versions.length === 0) {
    console.log('No versions yet.');
    return;
  }

  const rows = [...versionsData.versions].reverse();
  for (const entry of rows) {
    if (entry.comment) {
      console.log(`v${entry.number} - ${entry.comment}`);
    } else {
      console.log(`v${entry.number}`);
    }
  }
}
