#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export MAIL_DRY_RUN="${MAIL_DRY_RUN:-true}"
python harness/red_attack.py "${1:-5}"
python harness/blue_defend.py "${1:-5}"
