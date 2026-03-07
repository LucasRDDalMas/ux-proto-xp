# UX Proto Environment - Technical Architecture (V2)

## 1. Goal

Build one central repository (`ux-proto`) that lets UX create and iterate on isolated frontend prototypes from real source projects, while keeping:

- source projects reference-only
- prototypes editable
- version history per prototype
- one visible working tree per prototype
- prototype history hidden from outer repo history

The workspace repo orchestrates creation, save/history/rollback, run, list, and sync.

## 2. Non-Goals (MVP)

- no custom diff engine
- no per-prototype remote repos
- no nested `.git` inside prototype working folders
- no automatic onboarding discovery
- no conflict auto-resolution during sync

## 3. Canonical Model

### 3.1 Layers

- Workspace layer: CLI, config, hidden history stores, visible prototype folders.
- Source layer: real project repos referenced by config.
- Prototype layer: copied frontend app working tree for UX edits.

### 3.2 Core Principle

- Source repos are read-only inputs for `create` and `sync`.
- Prototype files are edited only in `prototypes/<project>/<prototype-name>`.
- Versioning is maintained by hidden per-prototype Git data under `.ux-proto/repos/...`.

## 4. Canonical Folder Layout

```text
ux-proto/
├─ config/
│  └─ projects.json
├─ prototypes/
│  └─ <project>/
│     └─ <prototype-name>/
│        ├─ .uxproto/
│        │  ├─ meta.json
│        │  ├─ versions/
│        │  │  └─ index.json
│        │  └─ mock/
│        │     ├─ seed.json
│        │     └─ state.json
│        └─ <copied app files>
└─ .ux-proto/
   ├─ workspace.json
   └─ repos/
      └─ <project>/
         └─ <prototype-name>.git/
```

Notes:

- Source repo paths are config-driven (`projects.json`).
- There is no required `sources/` directory convention.
- Prototypes never contain an inner `.git` directory.

## 5. Config and Metadata Contracts

## 5.1 `config/projects.json`

`config/projects.json` is the source of truth for project onboarding.

```json
{
  "projects": {
    "project-a": {
      "sourcePath": "project-a-repo",
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

Rules:

- `sourcePath` is relative to workspace root.
- `sourceBranch` is required and used by both `create` and `sync`.
- `appPath` is relative to the source repo root.
- `installCommand` and `devCommand` are argv arrays (no shell string interpolation).

## 5.2 `<prototype>/.uxproto/meta.json`

Canonical schema:

```json
{
  "prototypeName": "project-data",
  "sourceProject": "project-a",
  "status": "active",
  "createdFrom": {
    "sourcePath": "project-a-repo",
    "sourceBranch": "main",
    "sourceCommit": "abc1234",
    "appPath": "."
  },
  "lastSyncedSourceCommit": "abc1234",
  "versioning": {
    "currentVersion": 2
  },
  "storage": {
    "gitDir": ".ux-proto/repos/project-a/project-data.git"
  },
  "mock": {
    "enabled": true,
    "seedPath": ".uxproto/mock/seed.json",
    "statePath": ".uxproto/mock/state.json"
  }
}
```

Rules:

- `versioning.currentVersion` is the only canonical current-version field.
- `lastSyncedSourceCommit` is required for three-way sync.
- `storage.gitDir` is workspace-relative and required.

## 5.3 `<prototype>/.uxproto/versions/index.json`

Canonical schema:

```json
{
  "versions": [
    {
      "number": 0,
      "commit": "f83d2a1",
      "comment": "initial"
    },
    {
      "number": 1,
      "commit": "a9b32cf",
      "comment": "added home page"
    }
  ]
}
```

Rules:

- Numbers are monotonic (`v0`, `v1`, `v2`, ...).
- `proto history` reads from this file, newest first.

## 6. Hidden Git Storage Model

Each prototype uses one hidden Git directory and one visible work tree:

- Git dir: `.ux-proto/repos/<project>/<prototype-name>.git`
- Work tree: `prototypes/<project>/<prototype-name>`

All versioning commands run Git with explicit flags:

```bash
git --git-dir <gitDir> --work-tree <prototypePath> <git-command>
```

Invariants:

- Outer workspace Git tracks prototype files as normal files.
- Hidden repo data is ignored by outer repo.
- No nested repository behavior in `prototypes/...`.

## 7. Command Semantics (MVP)

## 7.1 Location Rules

- `proto create <project> <name>`: workspace root only.
- `proto list`, `proto list archive`: anywhere inside workspace.
- `proto save`, `proto history`, `proto rollback`, `proto run`, `proto sync`: inside a prototype only.

If location is invalid, command fails with explicit guidance.

## 7.2 `proto create <project> <name>`

Flow:

1. Resolve workspace root.
2. Load and validate `projects.json`.
3. Validate `<project>` exists.
4. Validate destination `prototypes/<project>/<name>` does not exist.
5. Resolve source repo (`sourcePath`) and app path (`appPath`).
6. Update source repo safely on configured branch:
   - fail if source repo has local modifications
   - `git fetch origin`
   - `git checkout <sourceBranch>`
   - `git pull --ff-only origin <sourceBranch>`
7. Copy source app subtree into prototype working tree (exclude source `.git`, `node_modules`, build outputs, caches).
8. Initialize hidden Git dir at `.ux-proto/repos/<project>/<name>.git`.
9. Initialize `.uxproto/meta.json` and `.uxproto/versions/index.json`.
10. Generate mock files if configured.
11. Run install command from config in prototype directory.
12. Create initial save as `v0`.
13. Print success plus `cd` and `proto run` guidance.

Failure handling:

- If any step fails after copy starts, clean both:
  - `prototypes/<project>/<name>`
  - `.ux-proto/repos/<project>/<name>.git`

## 7.3 `proto save [--comment "..."]`

Flow:

1. Validate prototype context.
2. Validate hidden git dir exists and matches metadata.
3. Detect changes in work tree.
4. If no changes: print `nothing to save` and exit.
5. Stage tracked/untracked allowed files.
6. Commit with message format:
   - `uxproto: save vN`
   - `uxproto: save vN - <comment>`
7. Append new entry in `versions/index.json`.
8. Update `versioning.currentVersion` in `meta.json`.

## 7.4 `proto history`

Flow:

1. Validate prototype context.
2. Read `versions/index.json`.
3. Print newest-to-oldest in `vN` format with optional comment.

## 7.5 `proto rollback <version>`

Rollback behavior is "restore target, then save as new version".

Flow:

1. Validate prototype context.
2. Validate requested version exists in `versions/index.json`.
3. Resolve target commit hash for that version.
4. Replace working tree files with target commit content.
5. Immediately create a new save version (`vNext`) with comment `rollback to v<target>`.
6. Update metadata and versions registry.

Important:

- Rollback never rewrites history.
- Rollback always produces a new version entry.

## 7.6 `proto list` and `proto list archive`

`proto list`:

- Enumerate `prototypes/<project>/<prototype>` folders.
- For each prototype, show project, name, current version, status, and `lastSyncedSourceCommit`.

`proto list archive`:

- Enumerate `archive/<project>/<prototype-archive-name>`.
- Show archived metadata summary.

## 7.7 `proto run`

Flow:

1. Validate prototype context.
2. Resolve source project from metadata.
3. Load project `devCommand`.
4. If mock is enabled, start mock companion server first.
5. Start app dev server.
6. Forward signals and stop all child processes on exit.

Failure handling:

- Missing `devCommand` or mock startup failure should fail clearly.

## 7.8 `proto sync`

Precondition:

- Prototype working tree must be clean.
- If dirty, fail with: `Unsaved changes detected. Run proto save before proto sync.`

Flow:

1. Validate prototype context and clean work tree.
2. Read `lastSyncedSourceCommit` from metadata.
3. Update source repo safely using configured `sourceBranch` (`fetch`, `checkout`, `pull --ff-only`).
4. Resolve latest source commit and source app snapshot.
5. Build a temporary merge repo using three trees:
   - Base: snapshot at `lastSyncedSourceCommit` (source app subtree)
   - Ours: current prototype snapshot
   - Theirs: latest source snapshot
6. Attempt merge (`ours` + `theirs` using `base`).
7. If merge conflict:
   - abort merge
   - discard temp repo
   - leave prototype files unchanged
   - return conflict error
8. If merge succeeds:
   - apply merged tree to prototype work tree
   - update `lastSyncedSourceCommit` to latest source commit
   - create new save version with comment `sync from <sourceProject>@<shortCommit>`
9. Remove temp repo.

Guarantees:

- Conflict path makes no changes to prototype files.
- Success path preserves prototype edits when non-conflicting and incorporates upstream updates.

## 7.9 `proto archive` (post-MVP)

Flow:

1. Validate prototype context.
2. Require clean tree or explicit save first.
3. Move prototype folder to `archive/<project>/<name>--YYYY-MM-DD-HHmm`.
4. Remove hidden git dir `.ux-proto/repos/<project>/<name>.git`.
5. Update archived metadata status.

Note:

- Archive is current snapshot only.
- Internal version history is intentionally dropped by removing hidden git dir.

## 8. Safety and Consistency Rules

- No default `reset --hard` / `clean -fd` in source update flows.
- `sourceBranch` from config is always honored.
- No mixed version fields (`versioning.currentVersion` only).
- All command failures must explain how to recover.
- Copy and sync operations should use temp paths + atomic replace where possible.

## 9. Acceptance Scenarios

## 9.1 Create + Save + Rollback

1. `proto create project-a project-data` -> creates `v0`.
2. Add `home.html`, run `proto save` -> `v1`.
3. Modify `home.html`, run `proto save` -> `v2`.
4. Run `proto rollback 0` -> working tree matches v0 content and new version is `v3`.

## 9.2 Upstream Update + Sync Merge

1. Source project adds `survey.html` on configured branch.
2. Prototype has prior non-conflicting local edits.
3. Run `proto sync` -> prototype keeps local edits and receives `survey.html`; version increments.

## 9.3 Sync Conflict

1. Same lines changed both upstream and in prototype.
2. Run `proto sync` -> conflict error, prototype files unchanged.

## 9.4 Dirty Sync Guard

1. Unsaved edits exist in prototype.
2. Run `proto sync` -> fails with guidance to run `proto save` first.

## 9.5 Outer Repo Compatibility

1. Prototype files are normal files under `prototypes/...`.
2. Hidden Git histories live only under `.ux-proto/repos/...`.
3. Outer repo can commit/push current prototype files without nested repo issues.

## 10. Final Architecture Decision

The MVP uses:

- config-driven source paths
- one visible prototype working tree per prototype
- one hidden per-prototype Git history store
- rollback as new version
- sync as safe three-way merge with conflict abort and zero mutation on failure
- direct `proto ...` user command surface

This is the canonical V2 architecture and should replace prior conflicting guidance.
