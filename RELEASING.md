# Releasing tonespeak

Development happens on the private Gitea remote.  GitHub is a public mirror.
This document covers how a public release is cut and, in particular, how the
maintainer working doc (`HANDOFF.md`) stays out of the public repository.

## Publish (one command)

Both remotes update in a single coupled step.  Set the GitHub PAT into the
environment from your gitignored store (never paste it), then run the wrapper:

```powershell
$env:GH_PAT = (Get-Content <your-gitignored-pat-file> -Raw).Trim()
.\scripts\publish.ps1 -Tag v0.1.1        # -WhatIf to preview;  omit -Tag to skip tagging
```

`scripts\publish.ps1` is a thin wrapper over the brain-owned engine
`_templates\Publish-MultiRemote.ps1`.  It pushes full `main` to Gitea (`origin`),
builds a squashed single-commit mirror with `HANDOFF.md` stripped, and force-pushes
that to GitHub (`github`) `main`.  The GitHub push authenticates with the PAT only --
Git Credential Manager is cleared for that invocation, so the global cache (which
resolves to the wrong identity and 403s) is never consulted.  Run `-WhatIf` first;
it verifies the clean tree excludes `HANDOFF.md` without pushing anything.

The manual sequence below explains what the script automates;  it is kept for
reference and for environments without PowerShell.

## Why a clean public history

`HANDOFF.md` carries maintainer-only context (local vault paths, memory-file
locations, the Gitea address).  It belongs on Gitea, not on GitHub.  Removing it
only at the tip of `main` would not be enough:  the file would still be readable
in the public repository's history (`git log`, `git show`).  So the public repo
is published from a clean, squashed history that never contained it.

This also keeps internal detail from earlier commits (machine-specific paths,
the pre-isolation benchmark churn) out of the public record.

## Cut a release

From a clean working tree on `main` (Gitea), with the version in `package.json`
and `CHANGELOG.md` updated for the release:

```bash
# 1.  Verify the suite is green and the package contents are right.
npm test
npm pack --dry-run

# 2.  Build a single-commit public tree that omits HANDOFF.md.
#     Stage everything first, THEN unstage HANDOFF -- doing it the other way
#     round lets `git add -A` re-stage it.
git checkout --orphan public
git add -A
git rm --cached --quiet HANDOFF.md
git commit -m "tonespeak v0.1.0"

# 3.  Publish to GitHub and tag.
git remote get-url github >/dev/null 2>&1 || \
  git remote add github https://github.com/grayminds/tonespeak.git
git push --force github public:main
git tag -f v0.1.0
git push --force github v0.1.0

# 4.  Return to development.
git checkout main
git branch -D public
```

`HANDOFF.md` stays tracked on Gitea `main` throughout;  the `public` branch is a
disposable build artifact, rebuilt from `main` each release.

## Sanity check before pushing

Confirm the public tree carries nothing private:

```bash
git checkout public
git ls-files | grep -i handoff   # expect no output
git log --oneline                # expect a single release commit
git checkout main
```
