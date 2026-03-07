# ux-proto

Prototype orchestration workspace for UX.

## Requirements

- Node.js 20+
- Git

## Workspace marker

This repo uses `.ux-proto/workspace.json` as the workspace marker.

## Flow after cloning

1. Enter the workspace.

```bash
cd ux-proto-xp
```

2. Rehydrate source repos from `config/projects.json`.

```bash
make sources
```

3. Create your first prototype.

```bash
node cli/src/index.js create project-root my-prototype
```

4. Move into the prototype and run/save.

```bash
cd prototypes/project-root/my-prototype
node ../../../cli/src/index.js run
node ../../../cli/src/index.js save --comment "first change"
```

5. Check active prototypes from workspace root.

```bash
cd ../../..
node cli/src/index.js list
```

## Configure projects

Edit `config/projects.json`:

```json
{
  "projects": {
    "project-a": {
      "sourcePath": "projects/project-a-repo",
      "sourceUrl": "https://github.com/your-org/project-a.git",
      "sourceBranch": "main",
      "appPath": ".",
      "installCommand": ["npm", "install"],
      "devCommand": ["npm", "run", "dev"],
      "mock": {
        "enabled": true,
        "adapter": "axios-basic",
        "entryFiles": ["src/api/client.ts"],
        "typesRoot": "src/types/api"
      }
    }
  }
}
```

## Commands

Run with:

```bash
node cli/src/index.js <command>
```

Or install globally from this folder and use `proto`.

### `proto create <project> <prototype-name>`

- updates source repo from configured branch
- copies app subtree into `prototypes/<project>/<prototype-name>`
- initializes hidden repo at `.ux-proto/repos/<project>/<prototype-name>.git`
- writes `.uxproto/meta.json` and `.uxproto/versions/index.json`
- runs install command
- creates initial version `v0`

### `proto save [--comment "..."]`

- saves current prototype state as next version

### `proto history`

- prints version history newest first

### `proto rollback <version-number>`

- restores files to target version state
- immediately creates a new version (`vNext`)

### `proto sync`

- requires clean prototype
- updates source repo
- performs three-way merge (`lastSyncedSourceCommit`, prototype current, latest source)
- aborts on conflict with no prototype file mutation
- on success applies merged tree and creates a new save version

### `proto list [archive]`

- lists active prototypes or archived entries

### `proto run`

- starts mock companion server (if enabled)
- starts project dev command

### `proto archive [--save]`

- archives the current prototype into `archive/<project>/...`
- removes hidden version history (`.ux-proto/repos/<project>/<prototype>.git`)
- requires a clean tree, or use `--save` to create an archive checkpoint first

## Hidden history model

Visible prototype files live under `prototypes/...`.
Hidden Git history per prototype lives under `.ux-proto/repos/...`.
This avoids nested `.git` inside prototype directories.

Real source repos are expected under `projects/...` in this workspace.

## Bootstrap source repos

Clone/pull all configured source repositories into `projects/`:

```bash
make sources
```

Behavior:

- Uses `sourceUrl`, `sourcePath`, and `sourceBranch` from `config/projects.json`.
- If a repo is missing, it is cloned from `sourceUrl`.
- If a repo exists, it is updated with `fetch` + `checkout <sourceBranch>` + `pull --ff-only`.
- If a target folder exists but is not a Git repo, the command fails clearly.

## VS Code extension (interactive commands)

The extension is located at `extensions/proto`.

### Run in Extension Development Host

1. Open this repository in VS Code.
2. Select the debug config `Run Proto Extension`.
3. Press `F5` (or Run > Start Debugging).
4. VS Code opens a second Extension Development Host window with this same `ux-proto-xp` repo loaded as the workspace.
5. In that second window, open the `Proto` icon in the Activity Bar sidebar.
6. Use the `Actions` and `Prototypes` tree items, or run commands from Command Palette (`Cmd+Shift+P`) like:
   - `Proto: Bootstrap Sources`
   - `Proto: Save State`
   - `Proto: Onboard Repository`
   - `Proto: Create Prototype`
   - `Proto: Open Claude`
   - `Proto: Save Version`
   - `Proto: Sync Prototype`

The sidebar `Actions` section can also onboard a new repository by appending a project entry to `config/projects.json` and optionally running `make sources` immediately.
`Save State` stages normal workspace changes with `git add -A`, then commits and pushes with the default checkpoint message `chore: checkpoint ux-proto workspace state`. `projects/` stays out because it is ignored by `.gitignore`.
Each prototype in the sidebar also exposes a `Versions` subtree, and each version row has an inline rollback action with confirmation.

Note:
- Extension development always runs in a separate window from the one where you edit the extension source.
- This workspace includes `.vscode/launch.json` with `--extensionDevelopmentPath=${workspaceFolder}/extensions/proto` and `${workspaceFolder}` so VS Code loads the correct extension and opens the project at the same time.
- If you want to use the extension in a single normal VS Code window, install the `.vsix` instead of using `F5`.

### Optional: install as local `.vsix`

```bash
cd extensions/proto
npx @vscode/vsce package
code --install-extension proto-0.0.1.vsix
```
