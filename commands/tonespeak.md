---
name: tonespeak
description: Call any dialect by name (e.g. "/tonespeak noir" -- family resolved automatically), or a subcommand:  "stats" for telemetry, "park" to save the current dialect, "resume" to restore a parked dialect.  No arg prints help.
argument-hint: "<dialect|stats|park|resume> [lite]"
allowed-tools: ["Bash"]
---

!`bash "$HOME/.tonespeak/bin/dispatch" tonespeak $ARGUMENTS`
