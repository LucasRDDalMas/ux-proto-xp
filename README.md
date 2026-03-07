# ux-proto

Prototype orchestration workspace for UX.

## Requirements

- Node.js 20+
- Git

## Workspace marker

This repo uses `.ux-proto/workspace.json` as the workspace marker.

## Configure projects

Edit `config/projects.json`:

```json
{
  "projects": {
    "project-a": {
      "sourcePath": "projects/project-a-repo",
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

- If a repo is missing, it is cloned.
- If a repo exists, it is updated with `fetch` + `pull --ff-only`.
- If a target folder exists but is not a Git repo, the command fails clearly.
