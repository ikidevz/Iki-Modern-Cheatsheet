# Git & GitHub Cheatsheet for Developers

> A structured Git and GitHub CLI reference — everyday workflow through history rewriting, collaboration, and releases. Validated against **Git 2.55** and **GitHub CLI (`gh`) 2.9x** (latest stable as of September 2026). Commands below use the modern `git switch` / `git restore` split (Git 2.23+) instead of the older overloaded `git checkout`, since that's what current Git docs and most teams now recommend — the equivalent `checkout` form is noted inline where it helps to know it.

## 📑 Table of Contents

1. [🧑‍💻 Complete Working Examples](#complete-working-examples)
2. [⚙️ Setup & Configuration](#setup-configuration)
3. [📁 Repository Basics](#repository-basics)
4. [🌿 Branching & Merging](#branching-merging)
5. [🔄 Remote Repos & Syncing](#remote-repos-syncing)
6. [⏪ Undoing Changes & Rewriting History](#undoing-changes-rewriting-history)
7. [📦 Stashing, Cherry-Picking & Tags](#stashing-cherry-picking-tags)
8. [🔍 Inspecting History](#inspecting-history)
9. [🐙 GitHub CLI (gh) Essentials](#github-cli-gh-essentials)
10. [🔀 Pull Requests & Code Review](#pull-requests-code-review)
11. [⚙️ GitHub Actions Basics](#github-actions-basics)
12. [🔐 SSH, Auth & .gitignore](#ssh-auth-gitignore)
13. [⚠️ Common Gotchas](#common-gotchas)
14. [🎯 Best Practices](#best-practices)
15. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

**Git syntax cheatsheet**

| Task                           | Syntax                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| Clone a repo                   | `git clone <url>`                                             |
| Check status                   | `git status`                                                  |
| Stage changes                  | `git add <file>` / `git add -p` (interactive, chunk by chunk) |
| Commit                         | `git commit -m "message"`                                     |
| Create & switch branch         | `git switch -c <branch>` (or `git checkout -b <branch>`)      |
| Switch branch                  | `git switch <branch>`                                         |
| Discard working-dir changes    | `git restore <file>` (or `git checkout -- <file>`)            |
| Unstage a file                 | `git restore --staged <file>`                                 |
| Sync with remote               | `git fetch` / `git pull` / `git push`                         |
| Merge a branch in              | `git merge <branch>`                                          |
| Rebase onto another branch     | `git rebase <branch>`                                         |
| Undo last commit, keep changes | `git reset --soft HEAD~1`                                     |
| Undo a pushed commit safely    | `git revert <commit>`                                         |
| Stash work in progress         | `git stash` / `git stash pop`                                 |
| Apply a commit from elsewhere  | `git cherry-pick <commit>`                                    |
| View history                   | `git log --oneline --graph --all`                             |

**GitHub CLI (`gh`) syntax cheatsheet**

| Task                      | Syntax                                          |
| ------------------------- | ----------------------------------------------- |
| Authenticate              | `gh auth login`                                 |
| Create a repo             | `gh repo create <name> --public --source=.`     |
| Clone a repo              | `gh repo clone <owner>/<repo>`                  |
| Open a pull request       | `gh pr create --fill`                           |
| List / view PRs           | `gh pr list` / `gh pr view <number> --web`      |
| Review a PR               | `gh pr review <number> --approve`               |
| Merge a PR                | `gh pr merge <number> --squash --delete-branch` |
| Check PR CI status        | `gh pr checks <number>`                         |
| Create an issue           | `gh issue create --title "..." --body "..."`    |
| Sync a fork with upstream | `gh repo sync`                                  |
| View a workflow run       | `gh run list` / `gh run view <id> --log`        |

**Conventional commit prefixes**

| Prefix      | Use for                                                 |
| ----------- | ------------------------------------------------------- |
| `feat:`     | A new feature                                           |
| `fix:`      | A bug fix                                               |
| `docs:`     | Documentation only                                      |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |
| `test:`     | Adding or correcting tests                              |
| `chore:`    | Build process, tooling, or dependency changes           |

## 🧑‍💻 Complete Working Examples

Five end-to-end workflows you'll actually run. Each starts with a **Purpose** blurb so you can pick the right one before copying commands.

### 1. Everyday Feature Branch Workflow

**Purpose:** This is the loop you run for almost every task: branch off `main`, commit as you go, push, and open a PR. Use it as your default — everything else in this sheet is a variation for when something goes off the happy path.

```bash
git switch main
git pull origin main

git switch -c feature/add-checkout-validation
# ... make changes ...
git add -p                          # stage changes chunk by chunk, review each hunk
git commit -m "feat: validate checkout totals before payment submission"

git push -u origin feature/add-checkout-validation
gh pr create --fill --base main     # opens a PR using the branch's commits for title/body
gh pr checks --watch                # wait on CI before asking for review
```

### 2. Cleaning Up Commit History Before Review

**Purpose:** Use this when you've made a dozen messy "wip" commits and want reviewers to see a small number of clean, logical commits instead. It shows interactive rebase to squash/reword commits, and a force-push that's safe because it only overwrites _your own_ remote branch.

```bash
# Squash/reorder/reword the last 5 commits on your feature branch
git rebase -i HEAD~5

# In the editor: change `pick` to `squash` (or `s`) on commits you want
# folded into the one above them, save, then edit the combined message.

# Push the rewritten history — --force-with-lease refuses to overwrite
# if someone else pushed to this branch since you last fetched, unlike --force
git push --force-with-lease origin feature/add-checkout-validation
```

### 3. Fixing Mistakes Safely (Undo, Amend, Recover)

**Purpose:** Use this whenever something needs undoing — a typo in the last commit message, a commit you didn't mean to push, or work you're sure you lost. It demonstrates the three main "undo" tools in order of severity: amending, reverting a pushed commit without rewriting shared history, and using the reflog as a safety net when it seems like a commit vanished.

```bash
# Fix the most recent commit's message or add a forgotten file to it
git add forgotten_file.py
git commit --amend -m "fix: correct off-by-one error in pagination"

# Undo a commit that's already been pushed and others may have pulled —
# revert adds a new commit that undoes it, instead of rewriting history
git revert <bad-commit-sha>
git push origin main

# "I think I lost a commit" — the reflog tracks HEAD movements for ~90 days,
# even across resets, rebases, and branch deletions
git reflog
git reset --hard <sha-from-reflog>   # restore HEAD to that point
```

### 4. Syncing a Fork with Upstream

**Purpose:** Use this before starting any new contribution to an open-source project, and periodically while a long-running PR is open. It keeps your fork's `main` current with the upstream project and shows how to bring your feature branch up to date and resolve a conflict cleanly.

```bash
# One-time setup: point at the original repo in addition to your fork
git remote add upstream https://github.com/original-owner/project.git

# Bring your fork's main up to date
git switch main
git fetch upstream
git merge upstream/main
git push origin main

# Or, with GitHub CLI, if origin is your fork of an upstream repo:
gh repo sync

# Update your in-progress feature branch on top of the latest main
git switch feature/my-change
git rebase main
# If a conflict appears:
#   1. Open the flagged files, resolve the <<<<<<< / ======= / >>>>>>> markers
#   2. git add <resolved-file>
#   3. git rebase --continue
git push --force-with-lease origin feature/my-change
```

### 5. Hotfix Cherry-Pick and Release Tag

**Purpose:** Use this when a fix lands on `main` but also needs to ship on an older release branch that customers are still running — the classic backport. It shows applying a single commit to another branch without merging the whole branch, then tagging a new patch release.

```bash
# The fix already exists as a commit on main
git log --oneline main -5          # find the commit sha to backport

git switch release/2.4
git switch -c hotfix/2.4.1
git cherry-pick <fix-commit-sha>
# Resolve conflicts if any, then: git cherry-pick --continue

git push -u origin hotfix/2.4.1
gh pr create --base release/2.4 --fill

# After merge, tag the patch release
git switch release/2.4
git pull origin release/2.4
git tag -a v2.4.1 -m "Hotfix: resolve session timeout on login"
git push origin v2.4.1
gh release create v2.4.1 --generate-notes
```

## ⚙️ Setup & Configuration

```bash
# Identity — required before your first commit
git config --global user.name "Jane Doe"
git config --global user.email "jane@company.com"

# Sensible global defaults
git config --global init.defaultBranch main
git config --global pull.rebase true        # `git pull` rebases instead of merging
git config --global core.editor "code --wait"
git config --global fetch.prune true         # auto-remove stale remote-tracking branches

# Aliases save real typing over a career
git config --global alias.st status
git config --global alias.co switch
git config --global alias.lg "log --oneline --graph --all --decorate"

# Inspect current config (and where each value comes from)
git config --list --show-origin
```

## 📁 Repository Basics

```bash
git init                              # start a new repo in the current folder
git clone https://github.com/org/repo.git
git clone git@github.com:org/repo.git   # SSH form

git status                            # what's staged, unstaged, untracked
git add file1.py file2.py             # stage specific files
git add .                             # stage everything in the current directory
git add -p                            # interactively stage by hunk — review before committing

git commit -m "feat: add retry logic to the export job"
git commit -am "fix: typo in error message"   # stage tracked-file changes and commit in one step

git diff                              # unstaged changes vs. the last commit
git diff --staged                     # staged changes vs. the last commit
git rm file.py                        # remove a file and stage the removal
git mv old_name.py new_name.py        # rename and stage in one step
```

## 🌿 Branching & Merging

```bash
git branch                            # list local branches
git branch -a                         # list local + remote-tracking branches
git switch -c feature/new-api         # create and switch to a new branch
git switch main                       # switch back to an existing branch

git merge feature/new-api             # merge feature/new-api into the current branch
git merge --no-ff feature/new-api     # always create a merge commit, even for fast-forwards

git branch -d feature/new-api         # delete a branch (safe: refuses if unmerged)
git branch -D feature/new-api         # force-delete, even if unmerged
git push origin --delete feature/new-api   # delete the remote branch too

# Rename a branch (e.g. fixing a typo before pushing)
git branch -m old-name new-name
```

## 🔄 Remote Repos & Syncing

```bash
git remote -v                         # list configured remotes and their URLs
git remote add upstream <url>         # add a second remote (common in fork workflows)

git fetch origin                      # download new commits/branches, don't merge
git pull origin main                  # fetch + merge (or rebase, if pull.rebase=true)
git push origin feature/new-api       # push your branch
git push -u origin feature/new-api    # push AND set it as the branch's default upstream

git push --force-with-lease           # safe force-push: fails if remote moved since your last fetch
git push --tags                       # push tags, which aren't pushed by a plain `git push`
```

## ⏪ Undoing Changes & Rewriting History

```bash
# Working directory / staging area — nothing committed yet
git restore file.py                   # discard unstaged changes to a file
git restore --staged file.py          # unstage a file, keep the edits
git clean -fd                         # remove untracked files and directories (careful — irreversible)

# Committed, not yet pushed — safe to rewrite
git commit --amend -m "new message"   # edit the last commit's message and/or staged content
git reset --soft HEAD~1               # undo last commit, keep changes staged
git reset --mixed HEAD~1              # undo last commit, keep changes unstaged (default mode)
git reset --hard HEAD~1               # undo last commit AND discard the changes entirely

# Already pushed / shared with others — don't rewrite, add a new commit instead
git revert <commit-sha>               # create a commit that undoes another commit's changes

# Lost work recovery
git reflog                            # every place HEAD has pointed, including "deleted" commits
git reset --hard <sha>                # jump back to a point found in the reflog
```

## 📦 Stashing, Cherry-Picking & Tags

```bash
# Stash: shelve uncommitted work to switch branches cleanly
git stash                             # stash tracked changes
git stash -u                          # also stash untracked files
git stash list
git stash pop                         # reapply the most recent stash and remove it from the list
git stash apply stash@{1}             # reapply a specific stash, keep it in the list
git stash drop stash@{1}              # delete a stash without applying it

# Cherry-pick: apply one commit from another branch/history line
git cherry-pick <commit-sha>
git cherry-pick <sha1> <sha2>         # multiple commits, in order
git cherry-pick --continue            # after resolving a conflict mid-pick
git cherry-pick --abort               # bail out and return to the pre-pick state

# Tags: mark a specific commit, typically for releases
git tag v1.2.0                        # lightweight tag on the current commit
git tag -a v1.2.0 -m "Release 1.2.0"  # annotated tag — preferred, stores author/date/message
git push origin v1.2.0                # tags don't push automatically
git tag -d v1.2.0                     # delete a local tag
git push origin --delete v1.2.0       # delete a remote tag
```

## 🔍 Inspecting History

```bash
git log                               # full commit history
git log --oneline --graph --all       # compact, visual, all branches
git log -p -- file.py                 # full diffs for every change to one file
git log --author="Jane"               # filter by author
git log --since="2 weeks ago"

git show <commit-sha>                 # full diff and metadata for one commit
git blame file.py                     # who last changed each line, and in which commit
git diff main...feature/new-api       # what feature/new-api adds relative to where it branched from main

# Binary search for the commit that introduced a bug
git bisect start
git bisect bad                        # current commit is broken
git bisect good v1.1.0                # this earlier tag was fine
# Git checks out a midpoint commit each time — test it, then:
git bisect good   # or: git bisect bad
# ...repeat until Git identifies the exact offending commit...
git bisect reset
```

## 🐙 GitHub CLI (gh) Essentials

```bash
gh auth login                         # authenticate once per machine
gh auth status                        # confirm you're logged in and which account/scopes

gh repo create my-project --public --source=. --push   # create on GitHub from a local repo
gh repo clone org/repo
gh repo view org/repo --web           # open the repo page in a browser
gh repo sync                          # sync your fork's default branch with upstream

gh issue create --title "Bug: export fails on empty dataset" --body "Steps to reproduce..."
gh issue list --assignee @me
gh issue close 42

gh release create v1.3.0 --generate-notes   # cut a release from an existing tag, auto-written notes
gh release list

gh workflow list                      # list GitHub Actions workflows in this repo
gh run list --workflow=ci.yml
gh run watch                          # follow the in-progress run for the current branch
```

## 🔀 Pull Requests & Code Review

```bash
gh pr create --fill                          # title/body from commits, base = repo default branch
gh pr create --base develop --title "..." --body "..." --draft

gh pr list                                    # PRs in the current repo
gh pr view 128                                # details in the terminal
gh pr view 128 --web                          # open it in the browser
gh pr diff 128                                # the actual code diff

gh pr checks 128                              # CI status for a PR
gh pr checks 128 --watch                      # block until checks finish

gh pr review 128 --approve --body "LGTM"
gh pr review 128 --request-changes --body "Please add a test for the empty-input case"
gh pr comment 128 --body "Can you also update the docs?"

gh pr merge 128 --squash --delete-branch      # squash-merge and clean up the branch
gh pr merge 128 --rebase                      # rebase-merge instead, if that's the repo's convention
```

## ⚙️ GitHub Actions Basics

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: pytest
```

```bash
gh workflow run ci.yml                # manually trigger a workflow_dispatch-enabled workflow
gh run list --limit 5
gh run view --log-failed              # show only the failing step's logs from the latest run
gh secret set API_KEY --body "***"    # set a repo secret from the CLI instead of the web UI
```

## 🔐 SSH, Auth & .gitignore

```bash
# Generate a modern SSH key and add it to GitHub
ssh-keygen -t ed25519 -C "jane@company.com"
gh ssh-key add ~/.ssh/id_ed25519.pub --title "work-laptop"
ssh -T git@github.com                 # test the connection

# Switch an existing repo between HTTPS and SSH remotes
git remote set-url origin git@github.com:org/repo.git

# GPG/SSH-sign commits so GitHub shows a "Verified" badge
git config --global commit.gpgsign true
git config --global user.signingkey <key-id>
```

```gitignore
# .gitignore — common patterns
__pycache__/
*.pyc
.env
.venv/
node_modules/
dist/
.DS_Store
*.log
```

```bash
# A file is already tracked but should now be ignored?
# .gitignore alone won't remove it — untrack it explicitly:
git rm --cached secrets.env
echo "secrets.env" >> .gitignore
git commit -m "chore: stop tracking secrets.env"
```

## ⚠️ Common Gotchas

- **`git pull` can silently create a merge commit** you didn't expect — set `pull.rebase = true` globally if your team prefers a linear history, or always use `git pull --rebase` explicitly.
- **`--force` vs `--force-with-lease`** — plain `--force` overwrites the remote branch no matter what, even if a teammate pushed to it after your last fetch. `--force-with-lease` refuses in that case. Default to `--force-with-lease`.
- **`.gitignore` doesn't un-track already-committed files** — you must `git rm --cached` the file once before the ignore rule takes effect.
- **Rebasing shared/public branches rewrites history for everyone** — only rebase branches you own that nobody else has based work on; rewrite `main`/`develop` only with the whole team's agreement.
- **`git reset --hard` discards uncommitted work permanently** — there's no reflog entry for changes that were never committed. Stash or commit first if there's any doubt.
- **Detached HEAD after checking out a commit or tag directly** — commits made there aren't on any branch and can be lost once you switch away; create a branch (`git switch -c temp-branch`) first if you intend to keep the work.
- **A squash-merged PR's commits don't map 1:1 to `main`** — after a squash merge, `git rebase main` on a related branch may re-apply already-merged changes as "new" ones; prefer rebasing onto the specific commit or starting a fresh branch.
- **Large binary files bloat the repo forever** — once committed, they stay in history even after deletion, unless you rewrite history (`git filter-repo`) or use Git LFS from the start.

## 🎯 Best Practices

```bash
# Small, focused commits with imperative-mood messages
git commit -m "fix: prevent duplicate webhook delivery on retry"
# not: git commit -m "fixed stuff" / "wip" / "more changes"

# Pull before you branch, branch before you code
git switch main && git pull
git switch -c feature/short-descriptive-name

# Review your own diff before committing — catches debug prints, stray files
git diff --staged

# Keep main always deployable — merge only via reviewed, passing PRs
gh pr merge --squash --delete-branch

# Write a real PR description: what changed, why, and how it was tested
gh pr create --title "feat: add retry backoff to export job" \
  --body "$(cat <<'EOF'
## What
Adds exponential backoff to the export job's HTTP retries.

## Why
Export jobs were failing hard on transient 503s from the partner API.

## Testing
Added unit tests for the backoff calculation; ran the job against staging.
EOF
)"
```

## 💡 Pro Tips

1. **Use `git switch` and `git restore`** instead of the overloaded `git checkout` — the intent is clearer and mistakes are harder to make.
2. **Default to `--force-with-lease`**, never bare `--force`, when you must overwrite a remote branch.
3. **`git add -p` before every commit** — it forces you to actually look at every change, not just trust `git add .`.
4. **Alias your most-used long commands** (`git config --global alias.lg "log --oneline --graph --all"`).
5. **Use the reflog before panicking** — almost nothing in Git is truly gone for ~90 days.
6. **Rebase your feature branch, don't merge `main` into it**, to keep history linear and PR diffs clean.
7. **Sign your commits** (`commit.gpgsign true`) if your org requires verified commits.
8. **`gh pr checks --watch`** before requesting review — don't make reviewers wait on CI you could've caught yourself.
9. **Tag releases with annotated tags** (`git tag -a`), not lightweight ones — they carry a message, author, and date.
10. **Keep secrets out of git entirely** — `.gitignore` them from day one and use `gh secret set` / a secrets manager instead of committing `.env` files.
11. **`git bisect`** beats manually checking out commits one by one when hunting a regression.
12. **Squash-merge PRs from long-lived feature branches**; merge-commit (`--no-ff`) release branches where you want the branch structure preserved in history.
13. **Set up branch protection** on `main` (required reviews + passing checks) so bad merges can't happen even by accident.
14. **Use Git LFS for large binaries** (images, models, datasets) from the start — retrofitting later requires rewriting history.
15. **Read the diff `gh pr create` is about to post** before you post it — `--fill` is convenient but occasionally pulls in a stale commit message as the PR title.
