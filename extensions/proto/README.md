# Proto VS Code Extension

Interactive sidebar + command-palette extension for `ux-proto` workflows.

## Sidebar

- Open the `Proto` icon in the VS Code Activity Bar.
- `Actions` section provides workspace-level commands.
- `Prototypes` section groups prototypes by project; expand a project, then expand a prototype to run `run/save/history/rollback/sync/archive`.
- Each prototype includes a `Versions` subtree with every saved version.
- Version rows include an inline rollback action and confirm before running the rollback.
- The sidebar auto-refreshes when prototype metadata/version files change.
- Use the refresh button in the view title to force a reload.
- Use `Onboard Repository` to add a new project entry to `config/projects.json` from the UI.

## Commands

- `Proto: Bootstrap Sources`
- `Proto: Save State`
- `Proto: Onboard Repository`
- `Proto: Create Prototype`
- `Proto: Save Version`
- `Proto: List Active Prototypes`
- `Proto: List Archived Prototypes`
- `Proto: Run Prototype`
- `Proto: Open Claude`
- `Proto: Open Codex`
- `Proto: Sync Prototype`
- `Proto: Archive Prototype`

## Settings

- `uxProto.cliCommand` (default: `node cli/src/index.js`)
- `uxProto.terminalName` (default: `ux-proto`)

## Notes

- Extension locates workspace root by searching for `.ux-proto/workspace.json`.
- Commands run in integrated terminals so output is visible and long-running processes remain interactive. Each action opens its own terminal session to avoid sending new commands into an already-running dev server or agent session.
- Short-lived actions auto-close their terminal on success and stay open on failure. Long-running actions such as `Run`, `Open Claude`, and `Open Codex` stay open.
- `Save State` stages normal workspace changes with `git add -A`, then commits and pushes using the default message `chore: checkpoint ux-proto workspace state`. `projects/` stays out because it is ignored by `.gitignore`.
- `Open Claude` opens the shared terminal in the selected prototype folder and runs `claude`.
- `Open Codex` opens the shared terminal in the selected prototype folder and runs `codex`.
