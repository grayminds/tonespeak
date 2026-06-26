# Security Policy

## Reporting a vulnerability

Report security issues privately to **michael-tech@grayminds.com**.  Please do
not open a public issue for a suspected vulnerability.  Include reproduction
steps and the affected version.  You can expect an acknowledgement within a few
days.

## Scope and threat model

tonespeak is a local Claude Code plugin.  It runs on your machine, ships zero
runtime dependencies, and makes no network calls of its own.  Practically, that
narrows what counts as a security issue:

- **In scope:**  the installer (`bin/install.js`) writing outside its intended
  paths, the dispatch shim executing untrusted input, the frontmatter loader
  mishandling a crafted dialect file, or any path-traversal or command-injection
  in the Node sources.
- **Out of scope:**  the behavior of the underlying `claude` CLI or the Anthropic
  API, and the content a model generates while a dialect is active.

## Secrets

The only secret the project touches is an Anthropic API key used by the eval
harness.  It lives in a gitignored `.env.local` at the repository root and is
never committed.  See `.env.example`.  Nothing else in the project requires
credentials.
