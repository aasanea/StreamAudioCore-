# Release & Versioning Workflow Guide

This document defines the strict versioning and release policy for **StreamAudio Core**. All developers and automated agents must adhere to this workflow to ensure that the production code remains stable, fully functional, and frozen between planned releases.

---

## 📌 1. Branching Strategy Overview

We use a Git-based development isolation strategy composed of the following branches:

```text
  [v1.0.0 Tag] ------> [Hotfix v1.0.1 Tag] ----------> [Release v1.1.0 Tag]
       |                      ^                             ^
  main -----------------------|-----------------------------|------------------> (Stable / Prod)
       \                      |                            /
        \                     v                           /
develop  \--------------------+--------------------------/---------------------> (Active Dev)
          \                                             /
           \---> feature/new-ui -----------------------/
```

| Branch | Source | Target | Direct Commits? | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`main`** | *None* | *None* | **Strictly Forbidden** | Represents the current stable, frozen production state. Every commit is tagged (e.g., `v1.0.0`). |
| **`develop`** | `main` | `main` | Allowed for config/docs | The integration branch for new features and ready changes. |
| **`feature/*`** | `develop` | `develop` | Allowed | Isolated workspace for new features, design changes, and experiments. |
| **`hotfix/*`** | `main` | `main` & `develop` | Allowed | Critical production bug fixes. |

---

## 🔒 2. Strict Safety Rules

1. **Production Freeze**:
   - The codebase on `main` is considered **frozen**. 
   - No features, experimental changes, or refactors can be pushed directly to `main`.
2. **Development Isolation**:
   - All code edits, new features, and experiments **MUST** happen on `develop` or a dedicated `feature/*` branch.
3. **No Direct Edits on Stable Codebase**:
   - Direct changes to code on `main` are blocked. Bug fixes are permitted on `main` only via an isolated `hotfix/*` branch.
4. **Clean Integration**:
   - Features must be tested and stable in `develop` before they are promoted to a production release.

---

## 🏷️ 3. Semantic Versioning (SemVer)

All releases must follow Semantic Versioning (`MAJOR.MINOR.PATCH`):
*   **PATCH** (`+0.0.1`): Backward-compatible bug fixes (e.g., v1.0.1).
*   **MINOR** (`+0.1.0`): Backward-compatible new features (e.g., v1.1.0).
*   **MAJOR** (`+1.0.0`): API-breaking or backward-incompatible changes (e.g., v2.0.0).

---

## 🚀 4. Step-by-Step Workflows

### Scenario A: Developing a New Feature
1. Create a feature branch off `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```
2. Implement your changes, test them locally, and commit:
   ```bash
   git add .
   git commit -m "feat: implement your feature description"
   ```
3. Open a pull request or merge `feature/your-feature-name` into `develop`:
   ```bash
   git checkout develop
   git merge feature/your-feature-name
   git branch -d feature/your-feature-name
   ```

### Scenario B: Releasing a New Version
Once features on `develop` are tested, stable, and ready for release:
1. Ensure `develop` contains all changes and is fully tested.
2. Merge `develop` into `main`:
   ```bash
   git checkout main
   git merge develop --no-ff -m "release: v1.1.0"
   ```
3. Tag the release on `main`:
   ```bash
   git tag -a v1.1.0 -m "Release v1.1.0"
   ```
4. Merge back to `develop` to ensure release commits/tags are synced:
   ```bash
   git checkout develop
   git merge main
   ```

### Scenario C: Applying a Critical Bug Fix (Hotfix)
If a critical bug is discovered on the stable production version (`main`):
1. Branch from `main`:
   ```bash
   git checkout main
   git checkout -b hotfix/critical-bug-description
   ```
2. Apply the fix, test it, and commit.
3. Merge `hotfix/*` back into `main` and tag a new patch version:
   ```bash
   git checkout main
   git merge hotfix/critical-bug-description --no-ff
   git tag -a v1.0.1 -m "Hotfix v1.0.1: fix description"
   ```
4. Merge the fix back into `develop` as well:
   ```bash
   git checkout develop
   git merge hotfix/critical-bug-description
   git branch -d hotfix/critical-bug-description
   ```
