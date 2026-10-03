#!/bin/bash
set -euo pipefail

# Only run in Claude Code cloud sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Python deps for the image/heatmap scripts
if [ -f scripts/requirements.txt ]; then
  pip install -q -r scripts/requirements.txt
fi

# Ponytail plugin (idempotent: skip if already installed)
if ! claude plugin list 2>/dev/null | grep -q 'ponytail@ponytail'; then
  claude plugin marketplace add DietrichGebert/ponytail || true
  claude plugin install ponytail@ponytail
fi
