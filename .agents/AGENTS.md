# Project Rules & Agent Instructions

This repository enforces strict release, branching, and versioning rules to protect the stable production code.

## Git & Branching Constraints

1. **Active Branch Verification**:
   - Before executing any command or tool that writes files, edits files, or compiles code, the agent **MUST** run `git branch --show-current` to identify the current branch.
   - If the current branch is `main`, the agent **MUST NOT** perform any file writes or code modifications.
   - All changes must be developed on `develop` or a branch prefix `feature/*` or `hotfix/*`.

2. **Edits and Code Freeze**:
   - The `main` branch is considered **frozen** at a stable version release.
   - Do not make direct commits or code modifications on `main`.

3. **Merging & Release Promotion**:
   - Future releases are promoted only by merging `develop` to `main` with proper non-fast-forward merge and tagging.
   - Follow the detailed steps in [RELEASE_WORKFLOW.md](file:///d:/StreamAudioCore/RELEASE_WORKFLOW.md).

4. **Testing before Merge**:
   - Ensure the Tauri app builds successfully (`npm run build` or `npm run tauri build` depending on directory) before merging any changes to `develop` or `main`.
