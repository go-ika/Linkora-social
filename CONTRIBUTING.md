# Contributing to Linkora

Thanks for your interest in contributing! This document covers everything you need to get started: environment setup, branch conventions, the PR process, and the branch protection rules enforced on `main`.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Branch Conventions](#branch-conventions)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Branch Protection Rules](#branch-protection-rules)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)

---

## Prerequisites

- Node.js (version pinned in `.node-version`)
- pnpm (`npm install -g pnpm`)
- Rust + `wasm32v1-none` target (for contract development)
- Docker + Compose v2 (for running services locally)
- `stellar-cli` (for testnet deployments)

Run the setup script to verify all prerequisites and bootstrap the repo:

```bash
./scripts/setup.sh
```

---

## Environment Setup

```bash
# 1. Fork and clone the repo
git clone https://github.com/<your-username>/Linkora-social.git
cd Linkora-social

# 2. Install dependencies
pnpm install

# 3. Start local services (PostgreSQL, Redis, Indexer, etc.)
docker compose up -d

# 4. Copy environment files and fill in values
cp services/indexer/.env.example services/indexer/.env
```

---

## Branch Conventions

All work must happen on a feature branch. **Never commit directly to `main`** — direct pushes are blocked by branch protection.

| Branch prefix     | Purpose                                     |
| ----------------- | ------------------------------------------- |
| `feat/<slug>`     | New features                                |
| `fix/<slug>`      | Bug fixes                                   |
| `docs/<slug>`     | Documentation-only changes                  |
| `chore/<slug>`    | Tooling, CI, dependency updates             |
| `refactor/<slug>` | Code restructuring with no behaviour change |
| `test/<slug>`     | Adding or improving tests                   |

Examples:

```bash
git checkout -b feat/creator-token-supply
git checkout -b fix/indexer-pagination-off-by-one
git checkout -b docs/contributing-guide
```

---

## Making Changes

1. Create a branch from an up-to-date `main`:

   ```bash
   git fetch upstream
   git checkout -b feat/your-feature upstream/main
   ```

2. Make your changes. Keep each PR focused on a single concern.

3. Run checks locally before pushing:

   ```bash
   pnpm typecheck   # TypeScript
   pnpm lint        # ESLint
   pnpm test        # JS/TS tests
   pnpm build       # Verify all packages build
   cd packages/contracts && cargo test   # Rust contracts
   ```

4. Commit using the [Conventional Commits](#commit-messages) format.

---

## Pull Request Process

1. Push your branch to your fork:

   ```bash
   git push -u origin feat/your-feature
   ```

2. Open a PR against `julianajohn7202-stack/Linkora-social:main` (the upstream repo).

3. Fill in the PR template:
   - Describe what the PR does and why.
   - Reference the related issue with `Closes #<number>`.
   - Check off the testing checklist.

4. Wait for CI to pass — all status checks must be green before merge.

5. Request a review. At least **1 approving review** is required before the PR can be merged.

6. Address any review feedback, then re-request review.

7. Once approved and CI is green, a maintainer will merge using **Rebase and merge** (linear history is required — merge commits are not allowed).

---

## Branch Protection Rules

The `main` branch has the following protections configured on GitHub:

### Required: Pull Request Reviews

- **Minimum approvals:** 1
- Direct pushes to `main` are blocked — all changes must go through a PR.
- Dismisses stale reviews when new commits are pushed to the PR branch.
- Requires review from a `CODEOWNERS` owner when the changed files match a CODEOWNERS pattern.

### Required: Status Checks

The following CI jobs (defined in `.github/workflows/ci.yml`) **must pass** before a PR can be merged:

| Check                            | Description                                                            |
| -------------------------------- | ---------------------------------------------------------------------- |
| `JS/TS — typecheck, test, build` | TypeScript type checking, Jest tests, and build for all JS/TS packages |
| `Lint TypeScript Packages`       | ESLint across all TypeScript packages                                  |
| `Unit Tests`                     | Rust contract unit tests, fuzz tests, and invariant tests              |

Status checks are set to **strict** — the PR branch must be up to date with `main` before merging.

### Required: Linear History

- Merge commits are **not allowed** on `main`.
- PRs are merged using **Rebase and merge** or **Squash and merge** only.
- This keeps `git log` readable and `git bisect` reliable.

### Summary Table

| Rule                              | Setting                        |
| --------------------------------- | ------------------------------ |
| Require PR before merging         | ✅ Enabled                     |
| Minimum approvals                 | 1                              |
| Dismiss stale reviews on new push | ✅ Enabled                     |
| Require status checks to pass     | ✅ Enabled — all three CI jobs |
| Require branches to be up to date | ✅ Strict                      |
| Require linear history            | ✅ Enabled (no merge commits)  |
| Allow force pushes                | ❌ Disabled                    |
| Allow deletions                   | ❌ Disabled                    |

> **Note:** These rules are enforced at the GitHub repository level by maintainers. If you believe a protection rule is misconfigured, open an issue rather than trying to bypass it.

---

## Code Style

- **TypeScript:** Prettier (config in `.prettierrc`) + ESLint (config in `.eslintrc.base.json`). Run `pnpm lint` to check.
- **Rust:** `rustfmt` (config in `packages/contracts/rustfmt.toml`). Run `cargo fmt --check` before pushing.
- **Imports:** Keep imports sorted and remove unused ones.

Pre-commit hooks via Husky run Prettier automatically on staged files. Don't skip hooks with `--no-verify`.

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`

**Examples:**

```
feat(indexer): add cursor-based pagination to /posts endpoint
fix(sdk): handle missing ledger sequence in TransactionQueue
docs(contributing): add branch protection rules section
chore(deps): bump @stellar/stellar-sdk to 12.1.0
```

- Keep the summary under 72 characters.
- Use the imperative mood: "add feature" not "added feature".
- Reference issues in the footer: `Closes #123`.
