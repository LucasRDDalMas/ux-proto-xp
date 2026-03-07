#!/usr/bin/env node
import { createCommand } from './commands/create.js';
import { saveCommand } from './commands/save.js';
import { historyCommand } from './commands/history.js';
import { rollbackCommand } from './commands/rollback.js';
import { listCommand } from './commands/list.js';
import { runCommandHandler } from './commands/run.js';
import { syncCommand } from './commands/sync.js';
import { archiveCommand } from './commands/archive.js';

function usage() {
  console.log('Usage: proto <command> [args]');
  console.log('Commands:');
  console.log('  create <project> <prototype-name>');
  console.log('  save [--comment "..."]');
  console.log('  history');
  console.log('  rollback <version-number>');
  console.log('  list [archive]');
  console.log('  run');
  console.log('  sync');
  console.log('  archive [--save]');
}

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }

  switch (command) {
    case 'create':
      createCommand(args);
      return;
    case 'save':
      saveCommand(args);
      return;
    case 'history':
      historyCommand();
      return;
    case 'rollback':
      rollbackCommand(args);
      return;
    case 'list':
      listCommand(args);
      return;
    case 'run':
      await runCommandHandler();
      return;
    case 'sync':
      syncCommand();
      return;
    case 'archive':
      archiveCommand(args);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
