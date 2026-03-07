# Proto VS Code Extension

Interactive sidebar + command-palette extension for `ux-proto` workflows.

## Sidebar

- Open the `Proto` icon in the VS Code Activity Bar.
- `Actions` section provides workspace-level commands.
- `Prototypes` section groups prototypes by project; expand a project, then expand a prototype to run `run/save/history/rollback/sync/archive`.
- The sidebar auto-refreshes when prototype metadata/version files change.
- Use the refresh button in the view title to force a reload.
- Use `Onboard Repository` to add a new project entry to `config/projects.json` from the UI.

## Commands

- `Proto: Bootstrap Sources`
- `Proto: Onboard Repository`
- `Proto: Create Prototype`
- `Proto: Save Version`
- `Proto: Show History`
- `Proto: Rollback Version`
- `Proto: List Active Prototypes`
- `Proto: List Archived Prototypes`
- `Proto: Run Prototype`
- `Proto: Sync Prototype`
- `Proto: Archive Prototype`

## Settings

- `uxProto.cliCommand` (default: `node cli/src/index.js`)
- `uxProto.terminalName` (default: `ux-proto`)

## Notes

- Extension locates workspace root by searching for `.ux-proto/workspace.json`.
- Commands run in an integrated terminal so output is visible and long-running processes remain interactive.
