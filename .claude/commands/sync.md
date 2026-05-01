---
description: Project sync-check via cosmos-tracker agent — verifieert versioning, CHANGELOG, webpages, deploy-readiness
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# /sync

Voer een complete project-compliance check uit via de **cosmos-tracker agent**.

Spawn de agent en laat hem:

1. **Read** alle bronnen-van-waarheid (VERSION, package.json, CHANGELOG.md, play/index.html, prd/index.html, README.md, memory)
2. **Verify** alle versie-strings matchen
3. **Verify** CHANGELOG heeft entry voor huidige VERSION
4. **Auto-fix** discrepanties waar mogelijk (HUD-pill, package.json version, footer-version)
5. **Run** `npm run updates:build` om `/updates/` te regenereren uit CHANGELOG
6. **Run** `npm run typecheck` voor type-coherentie
7. **Report** in `.claude/sync-reports/sync-<timestamp>.md` met sync-status + commit-suggestie
8. **Output** kort rapport in chat: ✓ / ✗ per check + suggested commit message

**Belangrijk**: tracker MAG NIET zelf committen/pushen. Output suggested commit message; user beslist.

Bij mismatches die de tracker niet kan auto-fixen: blokkeer met concrete suggestie wat de user moet doen.

## Wanneer te gebruiken

- Aan het einde van een sprint (voor je commit)
- Voor je een PR/deploy uitstuurt
- Wanneer je twijfelt of CHANGELOG / version-strings nog kloppen
- Periodiek tussen sprints

Spawn de cosmos-tracker agent nu.
