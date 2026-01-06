# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

devark-cli is a TypeScript CLI for tracking and analyzing Claude Code sessions. Distributed as an NPX package (`npx devark-cli`).

**Key Stack**: TypeScript 5.3+, Commander.js, Inquirer.js, Better-SQLite3, Vitest, tsup

## Common Commands

```bash
# Build (includes type-check)
npm run build

# Development watch mode
npm run dev

# Run all tests
npm test

# Run single test file
npx vitest tests/unit/lib/config.test.ts

# Run tests matching pattern
npx vitest -t "should encrypt"

# Type check only
npm run type-check

# Full validation (lint + types + tests + security)
npm run check-all

# Debug mode
DEVARK_DEBUG=1 npx devark-cli send
```

## Architecture

```
src/
├── commands/     # CLI command handlers (auth, send, status, hooks-*, statusline, standup-*)
├── lib/
│   ├── api-client.ts     # Centralized API with rate limiting, retry, request IDs
│   ├── config.ts         # AES-256-GCM encrypted config storage
│   ├── detector.ts       # Setup state detection (FIRST_TIME, LOCAL_ONLY, CLOUD_AUTO)
│   ├── auth/             # Browser OAuth + SSE token exchange
│   ├── hooks/            # Claude Code hook management
│   ├── readers/          # Session parsers (claude.ts, cursor.ts)
│   ├── sub-agents/       # Sub-agent lifecycle management
│   └── ui/               # Terminal UI components (menus, selectors, progress)
├── types/        # TypeScript definitions
└── utils/        # Helpers (errors, validation)
tests/            # Vitest tests (unit/, integration/)
```

## Key Patterns

### Session Upload Pattern
**IMPORTANT**: Always use `sendWithTimeout({ selectedSessions })` when uploading sessions:
```typescript
import { sendWithTimeout } from './commands/send';
await sendWithTimeout({ selectedSessions }); // selectedSessions: SelectedSessionInfo[]
```
Never call `apiClient.uploadSessions()` directly - send command handles all processing.

### Auth Wizard Mode
Use `wizardMode: true` to suppress menu messages during guided flows:
```typescript
await runAuth({ wizardMode: true });
```

## Hook System

**Naming Convention**: All hooks use PascalCase (`PreCompact`, `SessionStart`, `SessionEnd`, `Stop`). Legacy camelCase is not supported.

### Hook Files (`/src/lib/hooks/`)
- `hooks-controller.ts` - Install/configure hooks, version tracking (v2.0.0+)
- `hook-lock.ts` - File-based locking, prevents concurrent execution (5-min stale timeout)
- `hook-sync.ts` - Tracks last sync timestamps, prevents duplicate uploads
- `hooks-manager.ts` - Status checking, uninstall, settings.json validation

### Hook Installation Modes
- **Global**: `~/.claude/settings.json` - applies to all projects
- **Per-project**: `.claude/settings.local.json` - project-specific
- **Settings Precedence**: Enterprise > Project local > Project shared > Global

### Hook Triggers
- **SessionStart**: `startup`, `resume`, `clear` events
- **PreCompact**: Before context compression (manual/automatic)

## Project Tracking

**Tracking ID**: Claude folder path (stable identifier)
- Example: `~/.claude/projects/-Users-username-projects-my-app`
- Never track by actual cwd path - it can vary

**Display Name**: Extract from `cwd` field in session JSONL files
- Session line: `{ "cwd": "/Users/username/projects/my-app", ... }`
- Display: last segment (`my-app`)

**Settings files are source of truth** - no separate tracking config needed

```bash
# View Claude project directories
ls ~/.claude/projects | head -20
```

## Important Notes

1. **No backward compatibility required** - Product hasn't launched yet
2. **Cross-platform priority** - Must work on macOS and Windows
3. **NPX distribution** - Package must be executable via `npx devark-cli`
4. **Manual testing** - Don't run `node devark.js` directly; use proper CLI commands
5. **Type safety** - Always run `npm run build` to catch type errors

## Release Process

1. Update CHANGELOG.md
2. Bump version: `npm version patch` (or minor/major)
3. Validate: `npm run check-all`
4. Publish: `npm publish`
5. Push: `git push origin main --tags`