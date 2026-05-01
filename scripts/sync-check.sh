#!/bin/bash
# sync-check.sh — Quick coherence check zonder agent. Voor pre-commit-hook of CI.
# Returns 0 if all checks pass, 1 otherwise.

set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

EXIT_CODE=0

VERSION=$(cat VERSION | tr -d '[:space:]')
PKG_VERSION=$(node -p "require('./package.json').version")
HUD_VERSION=$(grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+[^"]*' play/index.html | head -1 | sed 's/v//')

echo "🛰️  Cosmos Tracker — sync-check.sh"
echo "================================="

# 1. Version coherence
if [ "$VERSION" = "$PKG_VERSION" ]; then
  echo -e "${GREEN}✓${NC} VERSION ($VERSION) matches package.json"
else
  echo -e "${RED}✗${NC} VERSION ($VERSION) ≠ package.json ($PKG_VERSION)"
  EXIT_CODE=1
fi

if [[ "$HUD_VERSION" == "$VERSION"* ]]; then
  echo -e "${GREEN}✓${NC} play/index.html HUD-pill mentions v$VERSION"
else
  echo -e "${YELLOW}!${NC} play/index.html HUD-pill version ($HUD_VERSION) doesn't start with $VERSION"
  EXIT_CODE=1
fi

# 2. CHANGELOG actuality
if grep -q "## \[$VERSION\]" CHANGELOG.md; then
  echo -e "${GREEN}✓${NC} CHANGELOG has entry for v$VERSION"
else
  echo -e "${RED}✗${NC} CHANGELOG missing entry for v$VERSION"
  EXIT_CODE=1
fi

# 3. /updates/ freshness
if [ public/updates/index.html -nt CHANGELOG.md ]; then
  echo -e "${GREEN}✓${NC} /updates/ is newer than CHANGELOG (regenerated recently)"
else
  echo -e "${YELLOW}!${NC} /updates/ may be stale — run 'npm run updates:build'"
fi

# 4. Type-check
if npm run typecheck > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} TypeScript typecheck passes"
else
  echo -e "${RED}✗${NC} TypeScript typecheck FAILED — run 'npm run typecheck' for details"
  EXIT_CODE=1
fi

# 5. Git status
if git diff --quiet HEAD -- ':!public/updates/index.html'; then
  echo -e "${GREEN}✓${NC} Working tree clean (or only updates/index.html uncommitted)"
else
  CHANGED=$(git diff --name-only HEAD | grep -v "public/updates/index.html" | wc -l | tr -d ' ')
  echo -e "${YELLOW}!${NC} $CHANGED files changed — review with 'git status'"
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}🎉 All checks passed.${NC} Ready to commit v$VERSION."
else
  echo -e "${RED}❌ Some checks failed.${NC} Fix issues above before committing."
fi

exit $EXIT_CODE
