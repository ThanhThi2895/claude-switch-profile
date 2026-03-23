# Claude Switch Profile - Code Standards

## Overview

This document defines the coding conventions, architectural patterns, and quality standards for the Claude Switch Profile (CSP) project. All contributions must follow these standards.

## File & Directory Structure

### Project Layout

```
claude-switch-profile/
├── bin/
│   └── csp.js                  # CLI entry point
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
│   │   ├── launch.js
│   │   └── uninstall.js
│   ├── constants.js            # Configuration & paths
│   ├── profile-store.js        # Metadata management
│   ├── symlink-manager.js      # Symlink operations
│   ├── file-operations.js      # File/dir copy/restore
│   ├── profile-validator.js    # Validation logic
│   ├── safety.js               # Locks, backups, detection
│   ├── output-helpers.js       # Console formatting
│   └── platform.js               # Cross-platform compatibility
├── tests/
│   ├── core-library.test.js    # Unit tests
│   ├── cli-integration.test.js # Integration tests
│   └── safety.test.js          # Safety feature tests
├── package.json
├── README.md
└── docs/
    ├── project-overview-pdr.md
    ├── system-architecture.md
    └── code-standards.md       # This file
```

### File Naming Conventions

- **Commands:** `{command-name}.js` (e.g., `create.js`, `use.js`)
- **Core modules:** `{purpose}.js` (e.g., `profile-store.js`, `symlink-manager.js`)
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
import { saveSymlinks } from '../symlink-manager.js';
import { success, error } from '../output-helpers.js';
```

**Rationale:** Clear separation makes dependencies visible at a glance.

---

### Naming Conventions

#### Variables & Functions

Use **camelCase** for variables and functions:

```javascript
// ✓ Good
const profileDir = getProfileDir(name);
const isActive = active === name;
function saveCurrentState() { }
const symlinks = readCurrentSymlinks();

// ✗ Bad
const ProfileDir = getProfileDir(name);
const is_active = active === name;
function save_current_state() { }
const Symlinks = readCurrentSymlinks();
```

#### Constants

Use **SCREAMING_SNAKE_CASE** for module-level constants:

```javascript
// ✓ Good
export const CLAUDE_DIR = process.env.CSP_CLAUDE_DIR || join(home, '.claude');
export const SYMLINK_ITEMS = [
  'CLAUDE.md',
  'rules',
  'agents',
];

// ✗ Bad
export const claudeDir = process.env.CSP_CLAUDE_DIR || join(home, '.claude');
export const symlink_items = ['CLAUDE.md', 'rules', 'agents'];
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
export const readCurrentSymlinks = () => {
  // Reads all managed symlinks from ~/.claude
  // Returns: { itemName: targetPath } or {} if none found
  const sourceMap = {};
  for (const item of SYMLINK_ITEMS) {
    // ...
  }
  return sourceMap;
};

// ✗ Bad - no documentation
export const readCurrentSymlinks = () => {
  const sourceMap = {};
  for (const item of SYMLINK_ITEMS) {
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

### File System Operations

Minimize file I/O:

```javascript
// ✓ Good - read once, reuse
const profiles = readProfiles();
const isActive = name === getActive();

// ✗ Bad - multiple reads of same data
const isActive = name === getActive();
const profileCount = Object.keys(readProfiles()).length;
```

### String Concatenation

Use template literals:

```javascript
// ✓ Good
const message = `Profile "${name}" created at ${profileDir}`;

// ✗ Bad
const message = 'Profile "' + name + '" created at ' + profileDir;
```

### Array Operations

Prefer built-in methods:

```javascript
// ✓ Good
const profileNames = Object.keys(profiles);
const diffs = items.filter(item => item.status === 'different');

// ✗ Bad
const profileNames = [];
for (const key of Object.keys(profiles)) {
  profileNames.push(key);
}
const diffs = [];
for (const item of items) {
  if (item.status === 'different') diffs.push(item);
}
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

### Allowed Dependencies

**External:**
- `chalk@^5.6.2` — Console colors
- `commander@^14.0.3` — CLI parsing

**Built-in Node.js only:**
- `fs`, `path`, `os`
- `child_process` (execSync for tar, execFileSync for process detection, spawn for launch)
- `readline` (for prompts)

### Adding New Dependencies

Before adding a new package, consider:

1. Is this available in Node.js built-ins?
2. Does it add significant value?
3. What's the maintenance burden?
4. Are there lighter alternatives?

Get approval before adding dependencies.

---

## Documentation Standards

### README.md

Include:
- Project description
- Installation instructions
- Quick start guide
- All commands with examples
- Configuration options
- Troubleshooting

### Code Comments

Document:
- Non-obvious logic
- Complex algorithms
- Gotchas and edge cases
- External dependencies (why used)

### Architecture Docs

Update when:
- Adding new modules
- Changing data structures
- Modifying flow/behavior

---

## Pre-commit Checklist

Before pushing code:

- [ ] All tests pass (`npm test`)
- [ ] No console.log (use output helpers)
- [ ] No hardcoded paths (use constants)
- [ ] Error messages are actionable
- [ ] Functions have single responsibility
- [ ] Comments explain "why", not "what"
- [ ] File names follow kebab-case
- [ ] No trailing whitespace
- [ ] Imports organized (builtins → external → local)

---

## Common Patterns

### Handling Missing Directories

```javascript
// ✓ Good - create if missing
export const ensureProfilesDir = () => {
  if (!existsSync(PROFILES_DIR)) {
    mkdirSync(PROFILES_DIR, { recursive: true });
  }
};
```

### Parsing JSON Safely

```javascript
// ✓ Good - handles missing files
export const readProfiles = () => {
  const metaPath = join(PROFILES_DIR, PROFILES_META);
  if (!existsSync(metaPath)) return {};
  return JSON.parse(readFileSync(metaPath, 'utf-8'));
};

// Alternative: with error handling
const readJsonSafe = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
};
```

### Atomic File Writes

```javascript
// ✓ Good - entire operation is atomic
export const writeProfiles = (data) => {
  ensureProfilesDir();
  writeFileSync(join(PROFILES_DIR, PROFILES_META), JSON.stringify(data, null, 2) + '\n');
};
```

### Resource Cleanup

```javascript
// ✓ Good - ensures cleanup even on error
export const withLock = async (fn) => {
  acquireLock();
  try {
    return await fn();
  } finally {
    releaseLock();  // Always executes
  }
};
```

---

## Code Review Checklist

When reviewing code, ensure:

- [ ] Follows naming conventions (camelCase, SCREAMING_SNAKE_CASE)
- [ ] Functions are under 50 lines and single-purpose
- [ ] Error handling is explicit (no silent failures)
- [ ] File paths use `join()` or `resolve()`
- [ ] Tests are comprehensive
- [ ] Comments explain "why", not "what"
- [ ] Output uses helpers (success, error, info, warn)
- [ ] No external dependencies added without approval
- [ ] README/docs updated if behavior changed

---

**Last Updated:** 2026-03-11
**Version:** 1.0.0
