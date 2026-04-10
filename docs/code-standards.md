# Claude Switch Profile - Code Standards

## Overview

This document defines the coding conventions, architectural patterns, and quality standards for the Claude Switch Profile (CSP) project. All contributions must follow these standards.

## File & Directory Structure

### Project Layout

```
claude-switch-profile/
├── bin/
│   └── csp.js                           # CLI entry point
├── src/
│   ├── commands/
│   │   ├── init.js
│   │   ├── current.js
│   │   ├── list.js
│   │   ├── create.js
│   │   ├── save.js
│   │   ├── use.js
│   │   ├── delete.js
│   │   ├── export.js
│   │   ├── import.js
│   │   ├── diff.js
│   │   ├── deactivate.js
│   │   ├── launch.js
│   │   ├── uninstall.js
│   │   ├── select.js
│   │   ├── status.js
│   │   └── toggle.js
│   ├── constants.js                    # Configuration & paths
│   ├── profile-store.js                # Metadata management
│   ├── runtime-instance-manager.js     # Runtime isolation
│   ├── item-manager.js                 # Item copy/restore operations
│   ├── launch-effective-env-resolver.js # Env variable resolution
│   ├── file-operations.js              # File/dir copy/restore
│   ├── profile-validator.js            # Validation logic
│   ├── safety.js                       # Locks, backups, detection
│   ├── output-helpers.js               # Console formatting
│   └── platform.js                     # Cross-platform compatibility
├── tests/
│   ├── core-library.test.js            # Unit tests
│   ├── cli-integration.test.js         # Integration tests
│   └── safety.test.js                  # Safety feature tests
├── scripts/
│   └── release.js                      # Release helper
├── package.json
├── README.md
└── docs/
    ├── project-overview-pdr.md
    ├── system-architecture.md
    ├── codebase-summary.md
    └── code-standards.md               # This file
```

### File Naming Conventions

- **Commands:** `{command-name}.js` (e.g., `create.js`, `use.js`)
- **Core modules:** `{purpose}.js` (e.g., `profile-store.js`, `launch-effective-env-resolver.js`)
- **Tests:** `{module}.test.js` (e.g., `core-library.test.js`)
- **Directories:** kebab-case (e.g., `src/commands/`)
- **All lowercase:** Prefer lowercase file names for consistency

## JavaScript Style & Conventions

### Module System

**Use ES modules (import/export):**

```javascript
// ✓ Good
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getActive } from '../profile-store.js';

export const currentCommand = () => {
  // ...
};

// ✗ Bad
const fs = require('fs');
module.exports = { currentCommand };
```

**Rationale:** ES modules are modern, performant, and support tree-shaking.

---

### Imports Organization

Group imports in this order:

```javascript
// 1. Node.js built-in modules (with 'node:' prefix)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// 2. External dependencies (npm packages)
import chalk from 'chalk';
import { Command } from 'commander';

// 3. Local modules (relative imports)
import { getActive, setActive } from '../profile-store.js';
import { copyItems, moveItems } from '../item-manager.js';
import { success, error } from '../output-helpers.js';
```

**Rationale:** Clear separation makes dependencies visible at a glance.

---

### Naming Conventions

#### Core modules

Use **camelCase** for variables and functions:

```javascript
// ✓ Good
const profileDir = getProfileDir(name);
const isActive = active === name;
function saveCurrentState() { }
const itemMap = readCurrentItems();

// ✗ Bad
const ProfileDir = getProfileDir(name);
const is_active = active === name;
function save_current_state() { }
const ItemMap = readCurrentItems();
```

#### Constants

Use **SCREAMING_SNAKE_CASE** for module-level constants:

```javascript
// ✓ Good
export const CLAUDE_DIR = process.env.CSP_CLAUDE_DIR || join(home, '.claude');
export const MANAGED_ITEMS = [
  'CLAUDE.md',
  'rules',
  'agents',
];

// ✗ Bad
export const claudeDir = process.env.CSP_CLAUDE_DIR || join(home, '.claude');
export const managed_items = ['CLAUDE.md', 'rules', 'agents'];
```

#### File Paths & Directories

Use descriptive names in paths:

```javascript
// ✓ Good
const profileDir = getProfileDir(name);
const backupPath = join(PROFILES_DIR, BACKUP_DIR, timestamp);

// ✗ Bad
const dir = getProfileDir(name);
const path = join(PROFILES_DIR, BACKUP_DIR, timestamp);
```

---

### Function Design

#### Single Responsibility

Each function should do one thing:

```javascript
// ✓ Good - focused
export const getActive = () => {
  const activePath = join(PROFILES_DIR, ACTIVE_FILE);
  if (!existsSync(activePath)) return null;
  return readFileSync(activePath, 'utf-8').trim() || null;
};

// ✗ Bad - does too much
export const manageProfiles = (action, name) => {
  if (action === 'get-active') {
    // get active logic
  } else if (action === 'set-active') {
    // set active logic
  } else if (action === 'list') {
    // list logic
  }
  // ...
};
```

#### Function Signature

Keep parameters under 3; use objects for multiple related params:

```javascript
// ✓ Good
export const createCommand = (name, options) => {
  // options = { from, description }
};

// ✗ Bad - too many params
export const createCommand = (name, from, description, isDefault, validate) => {
};
```

#### Return Values

Be explicit about return types in comments:

```javascript
// ✓ Good
export const readProfiles = () => {
  // Returns: { [profileName]: { created, description } } or {}
  const metaPath = join(PROFILES_DIR, PROFILES_META);
  if (!existsSync(metaPath)) return {};
  return JSON.parse(readFileSync(metaPath, 'utf-8'));
};

export const getActive = () => {
  // Returns: string (profile name) or null
  const activePath = join(PROFILES_DIR, ACTIVE_FILE);
  if (!existsSync(activePath)) return null;
  return readFileSync(activePath, 'utf-8').trim() || null;
};
```

---

### Error Handling

#### Use try/catch for Async Operations

```javascript
// ✓ Good
export const saveFiles = (profileDir) => {
  try {
    mkdirSync(profileDir, { recursive: true });
    for (const item of COPY_ITEMS) {
      const src = join(CLAUDE_DIR, item);
      if (existsSync(src)) {
        copyFileSync(src, join(profileDir, item));
      }
    }
  } catch (err) {
    error(`Failed to save files: ${err.message}`);
    process.exit(1);
  }
};

// ✗ Bad - silent failures
export const saveFiles = (profileDir) => {
  mkdirSync(profileDir, { recursive: true });
  for (const item of COPY_ITEMS) {
    try {
      const src = join(CLAUDE_DIR, item);
      if (existsSync(src)) {
        copyFileSync(src, join(profileDir, item));
      }
    } catch {
      // silently ignore
    }
  }
};
```

#### Exit on Fatal Errors

Commands that encounter fatal errors should exit:

```javascript
// ✓ Good
export const useCommand = async (name, options) => {
  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist.`);
    process.exit(1);  // Clear exit code
  }
  // ...
};

// ✗ Bad - throws instead of exiting
export const useCommand = async (name, options) => {
  if (!profileExists(name)) {
    throw new Error(`Profile "${name}" does not exist.`);
  }
};
```

#### Graceful Degradation

Skip missing items instead of failing:

```javascript
// ✓ Good - continues on missing items
export const saveFiles = (profileDir) => {
  for (const item of COPY_ITEMS) {
    const src = join(CLAUDE_DIR, item);
    if (existsSync(src)) {
      copyFileSync(src, join(profileDir, item));
    }
    // If item doesn't exist, skip it
  }
};

// ✗ Bad - fails on first missing item
export const saveFiles = (profileDir) => {
  for (const item of COPY_ITEMS) {
    const src = join(CLAUDE_DIR, item);
    copyFileSync(src, join(profileDir, item));
  }
};
```

---

### Comments & Documentation

#### Module Header

Every module should have a brief purpose comment:

```javascript
// profile-store.js
// Manages profile metadata (profiles.json) and active profile marker (.active)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
// ...
```

#### Function Comments

Document non-obvious functions:

```javascript
// ✓ Good - documents purpose and return
export const readCurrentItems = () => {
  // Reads all managed items from ~/.claude
  // Returns: { itemName: targetPath } or {} if none found
  const sourceMap = {};
  for (const item of MANAGED_ITEMS) {
    // ...
  }
  return sourceMap;
};

// ✗ Bad - no documentation
export const readCurrentItems = () => {
  const sourceMap = {};
  for (const item of MANAGED_ITEMS) {
    // ...
  }
  return sourceMap;
};
```

#### Inline Comments

Use sparingly; code should be self-documenting:

```javascript
// ✓ Good - explains why, not what
export const withLock = async (fn) => {
  acquireLock();
  try {
    return await fn();
  } finally {
    // Always release lock, even if fn throws
    releaseLock();
  }
};

// ✗ Bad - explains obvious code
export const withLock = async (fn) => {
  // Call acquireLock
  acquireLock();
  try {
    // Call fn
    return await fn();
  } finally {
    // Release the lock
    releaseLock();
  }
};
```

---

### Async/Await vs. Callbacks

Always use async/await for readability:

```javascript
// ✓ Good
export const deleteCommand = async (name, options) => {
  if (!options.force) {
    const confirmed = await confirm(`Delete profile "${name}"? (y/N) `);
    if (!confirmed) {
      warn('Cancelled.');
      return;
    }
  }
  rmSync(getProfileDir(name), { recursive: true });
};

// ✗ Bad - mixing callbacks
export const deleteCommand = (name, options, callback) => {
  if (!options.force) {
    confirm(`Delete profile "${name}"? (y/N) `, (confirmed) => {
      if (!confirmed) {
        callback(null);
        return;
      }
      rmSync(getProfileDir(name), { recursive: true });
      callback();
    });
  }
};
```

---

### Ternary vs. If/Else

Use ternary for simple conditions:

```javascript
// ✓ Good - simple condition
const marker = isActive ? ' * ' : '   ';

// ✓ Good - complex condition
if (!profileExists(name)) {
  error(`Profile "${name}" does not exist.`);
  process.exit(1);
}

// ✗ Bad - complex ternary
const marker = isActive && hasDescription && isRecent ? ' * ' : (hasDescription ? '   ' : '');
```

---

### Object Destructuring

Use destructuring for clarity:

```javascript
// ✓ Good
export const createCommand = (name, options) => {
  const { from, description } = options;
  if (from) {
    // ...
  }
};

// ✗ Bad
export const createCommand = (name, options) => {
  if (options.from) {
    // ...
  }
  const desc = options.description || '';
};
```

---

## Command Implementation Pattern

All command functions follow this pattern:

```javascript
import { getActive, setActive } from '../profile-store.js';
import { success, error } from '../output-helpers.js';

export const commandNameCommand = async (arg, options) => {
  // 1. Validate inputs
  if (!arg) {
    error('Argument required');
    process.exit(1);
  }

  // 2. Check preconditions
  if (!profileExists(arg)) {
    error(`Profile "${arg}" does not exist.`);
    process.exit(1);
  }

  // 3. Execute operation
  try {
    // do work
  } catch (err) {
    error(`Failed: ${err.message}`);
    process.exit(1);
  }

  // 4. Report results
  success(`Operation completed`);
};
```

---

## Testing Standards

### Test File Structure

```javascript
import assert from 'node:assert';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('module name', async (t) => {
  // Setup
  const tempDir = mkdtempSync(join(tmpdir(), 'csp-'));

  try {
    // Run test
    await t.test('should do something', () => {
      // Arrange
      const input = 'value';

      // Act
      const result = someFunction(input);

      // Assert
      assert.strictEqual(result, 'expected');
    });
  } finally {
    // Cleanup
    rmSync(tempDir, { recursive: true });
  }
});
```

### Test Naming

Use descriptive test names:

```javascript
// ✓ Good
test('should create profile with name and description', () => {});
test('should throw error if profile already exists', () => {});
test('should return empty object if profiles.json missing', () => {});

// ✗ Bad
test('create profile', () => {});
test('error case', () => {});
test('missing file', () => {});
```

### Assertions

Use strict equality by default:

```javascript
// ✓ Good
assert.strictEqual(result, expected);
assert.deepStrictEqual(obj, expectedObj);
assert.throws(() => someFunction(), Error);
assert.ok(condition);

// ✗ Bad
assert.equal(result, expected);  // Loose equality
assert.deepEqual(obj, expectedObj);  // Not strict
```

---

## Performance Guidelines

- Minimize file I/O: read once, reuse data
- Use template literals for string concatenation
- Prefer built-in array methods (`filter`, `map`, `Object.keys`)

```javascript
// ✓ Good - read once, reuse
const profiles = readProfiles();
const isActive = name === getActive();
const message = `Profile "${name}" created at ${profileDir}`;
```

---

## Output Standards

### Console Messages

Follow the pattern: **symbol + space + message**

```javascript
// success() - Green ✓
success('Profile created');      // ✓ Profile created

// error() - Red ✗
error('Profile not found');      // ✗ Profile not found

// warn() - Yellow ⚠
warn('Claude is running');       // ⚠ Claude is running

// info() - Blue ℹ
info('Location: /home/.claude'); // ℹ Location: /home/.claude
```

### User-Facing Text

Be concise and actionable:

```javascript
// ✓ Good - clear and helpful
error(`Profile "staging" does not exist. Run "csp list" to see available profiles.`);

// ✗ Bad - vague
error(`Profile "staging" not found`);
```

---

## Security Considerations

### Path Handling

Always use `path.join()` or `path.resolve()`:

```javascript
// ✓ Good - safe path manipulation
const profileDir = join(PROFILES_DIR, name);
const srcPath = resolve(CLAUDE_DIR, readlinkSync(symlink));

// ✗ Bad - path injection vulnerability
const profileDir = `${PROFILES_DIR}/${name}`;
```

### Environment Variables

Only use trusted env vars:

```javascript
// ✓ Good - whitelist
const home = process.env.CSP_HOME || homedir();
const claudeDir = process.env.CSP_CLAUDE_DIR || join(home, '.claude');

// ✗ Bad - unvalidated user input
const profilePath = process.env.PROFILE_PATH;
```

### File Operations

Always check existence before deletion:

```javascript
// ✓ Good - validates before deleting
if (existsSync(lockPath)) {
  unlinkSync(lockPath);
}

// ✗ Bad - may throw
unlinkSync(lockPath);  // Throws if doesn't exist
```

---

## Debugging & Logging

### Debug Strategy

Use error/info messages instead of console.log:

```javascript
// ✓ Good
info(`Backup created at ${backupPath}`);

// ✗ Bad
console.log('DEBUG: Backup at', backupPath);
```

### Error Messages

Include actionable context:

```javascript
// ✓ Good
if (!profileExists(name)) {
  error(`Profile "${name}" does not exist. Run "csp list" to see available profiles.`);
  process.exit(1);
}

// ✗ Bad
if (!profileExists(name)) {
  error('Profile not found');
  process.exit(1);
}
```

---

## Dependencies & Imports

**External:** `chalk@^5.6.2` (colors), `commander@^14.0.3` (CLI).
**Built-in:** `fs`, `path`, `os`, `child_process`, `readline`.
Get approval before adding new dependencies.

---

## Documentation Standards

- **README:** Description, install, quick start, all commands, config, troubleshooting
- **Code comments:** Non-obvious logic, gotchas, external deps rationale
- **Architecture docs:** Update when adding modules, changing data structures, or modifying flows


## Common Patterns

```javascript
// Handling missing directories
export const ensureProfilesDir = () => {
  if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true });
};

// Safe JSON reads
const readJsonSafe = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return {}; }
};

// Atomic writes
export const writeProfiles = (data) => {
  ensureProfilesDir();
  writeFileSync(join(PROFILES_DIR, PROFILES_META), JSON.stringify(data, null, 2) + '\n');
};

// Resource cleanup
export const withLock = async (fn) => {
  acquireLock();
  try { return await fn(); }
  finally { releaseLock(); }
};
```

---

## Code Review Checklist

- [ ] All tests pass (`npm test`)
- [ ] No console.log (use output helpers)
- [ ] No hardcoded paths (use constants)
- [ ] Error messages are actionable
- [ ] Functions are single-purpose and under 50 lines
- [ ] Comments explain "why", not "what"
- [ ] File names follow kebab-case
- [ ] Imports organized (builtins → external → local)
- [ ] File paths use `join()` or `resolve()`
- [ ] Tests are comprehensive
- [ ] Output uses helpers (success, error, info, warn)
- [ ] No external dependencies added without approval
- [ ] README/docs updated if behavior changed

---

**Last Updated:** 2026-03-31
**Version:** 1.4.0
