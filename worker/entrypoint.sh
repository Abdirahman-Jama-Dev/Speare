#!/usr/bin/env bash
set -euo pipefail

WORKSPACE=/workspace
RESULTS_FILE="$WORKSPACE/reports/results.json"

mkdir -p "$WORKSPACE"

# Extract the project bundle (project.tar.gz) from stdin.
# The bundle must contain: tests/, pages/, framework.config.yaml, and
# optionally data/, suites/, mocks/.
tar -xz -C "$WORKSPACE"

# Run Speare with the custom JSON reporter.
# All Playwright console output (list reporter, browser logs) is redirected
# to stderr so that stdout carries only the structured results JSON.
# The '|| true' prevents set -e from exiting when tests fail — test failures
# are a normal outcome reported in the JSON, not a worker error.
SPEARE_ROOT="$WORKSPACE" \
SPEARE_REPORTERS="speare-json" \
  node /app/dist/cli/index.js run 1>&2 || true

# Emit the results JSON to stdout for the backend to consume.
# A missing file means Speare crashed before writing results — treat as error.
if [[ ! -f "$RESULTS_FILE" ]]; then
  printf '{"status":"error","message":"Worker produced no output — check stderr for details"}\n'
  exit 1
fi

cat "$RESULTS_FILE"
