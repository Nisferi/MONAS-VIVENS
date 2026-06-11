#!/usr/bin/env bash
# Golden-прогон: детерминизм движка защищён тестом.
# Компилирует чистое ядро (без DOM) в temp и сравнивает хэши контрольных тиков.
set -euo pipefail
cd "$(dirname "$0")/.."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cp -r src/core src/phi src/run src/tablets "$TMP/"
mkdir "$TMP/future"
# Всё чистое из future/ (worker.ts требует DOM-типов — исключаем).
cp src/future/threat.ts src/future/horizon.ts src/future/events.ts "$TMP/future/"
find "$TMP" -name '*.ts' -exec sed -i -E "s|from '(\.\.?/[^']+)'|from '\1.js'|g" {} +

npx tsc "$TMP"/*/*.ts --outDir "$TMP/out" \
  --module nodenext --moduleResolution nodenext --target es2022 --strict

node scripts/golden.mjs "$TMP/out" "${1:-}"
