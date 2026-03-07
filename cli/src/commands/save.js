import path from 'node:path';
import { requirePrototypeContext, loadMeta } from '../core/prototype.js';
import { saveVersion } from '../core/versioning.js';

function parseComment(args) {
  const idx = args.indexOf('--comment');
  if (idx === -1) {
    return null;
  }

  if (!args[idx + 1]) {
    throw new Error('Missing value for --comment');
  }

  return args[idx + 1];
}

export function saveCommand(args) {
  const context = requirePrototypeContext(process.cwd());
  const meta = loadMeta(context.metaPath);

  const gitDir = path.join(context.workspaceRoot, meta.storage.gitDir);
  const comment = parseComment(args);

  const result = saveVersion({
    gitDir,
    prototypeRoot: context.prototypeRoot,
    versionsPath: context.versionsPath,
    metaPath: context.metaPath,
    meta,
    comment,
    allowEmpty: false
  });

  if (!result.saved) {
    console.log('nothing to save');
    return;
  }

  if (comment) {
    console.log(`Saved v${result.version} - ${comment}`);
  } else {
    console.log(`Saved v${result.version}`);
  }
}
