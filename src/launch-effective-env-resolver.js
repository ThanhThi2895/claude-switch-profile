import { LAUNCH_ANTHROPIC_ENV_KEYS, LAUNCH_CONFIG_ENV } from './constants.js';

const RESERVED_PARENT_ENV_KEYS = new Set(['CLAUDECODE', LAUNCH_CONFIG_ENV]);
const ANTHROPIC_KEY_SET = new Set(LAUNCH_ANTHROPIC_ENV_KEYS);

// Claude Code internal env vars that carry session/auth state between instances.
// These MUST be stripped to prevent a running default instance from leaking
// credentials into a profile-specific launch.
const CLAUDE_SESSION_ENV_PREFIXES = ['CLAUDE_CODE_OAUTH', 'CLAUDE_CODE_SESSION'];
const CLAUDE_SESSION_ENV_EXACT = new Set([
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_REMOTE',
  'CLAUDE_CODE_REMOTE_SESSION_ID',
  'CLAUDE_CODE_CONTAINER_ID',
  'CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR',
]);

const toUpperKey = (key) => String(key || '').toUpperCase();
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const sanitizeValue = (value) => {
  if (value === undefined || value === null) return undefined;
  return String(value);
};

const collectAnthropicValues = (source = {}) => {
  const collected = {};

  for (const [rawKey, rawValue] of Object.entries(source || {})) {
    const key = toUpperKey(rawKey);
    if (!ANTHROPIC_KEY_SET.has(key)) continue;

    const value = sanitizeValue(rawValue);
    if (value === undefined) continue;

    collected[key] = value;
  }

  return collected;
};

export const sanitizeInheritedLaunchEnv = (env = {}) => {
  const sanitized = {};

  for (const [key, value] of Object.entries(env || {})) {
    if (RESERVED_PARENT_ENV_KEYS.has(toUpperKey(key))) continue;
    sanitized[key] = value;
  }

  return sanitized;
};

const stripAnthropicKeys = (env = {}) => {
  const sanitized = {};

  for (const [key, value] of Object.entries(env || {})) {
    const upper = toUpperKey(key);
    // Strip all ANTHROPIC_* keys (will be re-added from profile settings)
    if (upper.startsWith('ANTHROPIC_')) continue;
    // Strip Claude Code session/auth env vars to prevent cross-instance leakage
    if (CLAUDE_SESSION_ENV_EXACT.has(upper)) continue;
    if (CLAUDE_SESSION_ENV_PREFIXES.some((prefix) => upper.startsWith(prefix))) continue;
    sanitized[key] = value;
  }

  return sanitized;
};

export const parseSettingsLaunchEnv = (settingsInput) => {
  if (!settingsInput) return {};

  let settings = settingsInput;

  if (typeof settingsInput === 'string') {
    settings = JSON.parse(settingsInput);
  }

  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {};
  }

  const envBlock = settings.env;
  if (!envBlock || typeof envBlock !== 'object' || Array.isArray(envBlock)) {
    return {};
  }

  return collectAnthropicValues(envBlock);
};

const stripUnquotedInlineComment = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith("'") || trimmed.startsWith('"')) {
    return trimmed;
  }

  const commentIndex = trimmed.indexOf('#');
  if (commentIndex === -1) return trimmed;

  return trimmed.slice(0, commentIndex).trimEnd();
};

const unquoteDotEnvValue = (value) => {
  const withoutInlineComment = stripUnquotedInlineComment(value);
  const trimmed = withoutInlineComment.trim();
  if (trimmed.length < 2) return trimmed;

  const startsWithSingle = trimmed.startsWith("'") && trimmed.endsWith("'");
  const startsWithDouble = trimmed.startsWith('"') && trimmed.endsWith('"');

  if (!startsWithSingle && !startsWithDouble) return trimmed;

  return trimmed.slice(1, -1);
};

export const parseDotEnvLaunchEnv = (content = '') => {
  const parsed = {};

  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, rawKey, rawValue] = match;
    const key = toUpperKey(rawKey);
    if (!ANTHROPIC_KEY_SET.has(key)) continue;

    parsed[key] = unquoteDotEnvValue(rawValue);
  }

  return parsed;
};

const resolveAnthropicValuesByPrecedence = ({ parentValues, dotEnvValues, settingsValues, launchOverrides }) => {
  // Highest -> lowest precedence:
  // launchOverrides > profile settings.env > profile .env (allowlist) > parent env
  const resolvedValues = {};
  const resolvedSources = {};

  const sources = [
    ['parent', parentValues],
    ['profile-dotenv', dotEnvValues],
    ['profile-settings', settingsValues],
    ['launch-override', launchOverrides],
  ];

  for (const [sourceName, sourceValues] of sources) {
    for (const key of LAUNCH_ANTHROPIC_ENV_KEYS) {
      if (!hasOwn(sourceValues, key)) continue;
      resolvedValues[key] = sourceValues[key];
      resolvedSources[key] = sourceName;
    }
  }

  return { resolvedValues, resolvedSources };
};

export const buildEffectiveLaunchEnv = ({
  parentEnv = process.env,
  profileSettingsEnv = {},
  profileDotEnvEnv = {},
  launchOverrides = {},
} = {}) => {
  const sanitizedParentEnv = sanitizeInheritedLaunchEnv(parentEnv);
  const baseEnv = stripAnthropicKeys(sanitizedParentEnv);

  const parentValues = collectAnthropicValues(parentEnv);
  const dotEnvValues = collectAnthropicValues(profileDotEnvEnv);
  const settingsValues = collectAnthropicValues(profileSettingsEnv);
  const overrideValues = collectAnthropicValues(launchOverrides);

  const { resolvedValues, resolvedSources } = resolveAnthropicValuesByPrecedence({
    parentValues,
    dotEnvValues,
    settingsValues,
    launchOverrides: overrideValues,
  });

  return {
    launchEnv: {
      ...baseEnv,
      ...resolvedValues,
    },
    diagnostics: {
      anthropicKeys: Object.keys(resolvedValues),
      anthropicKeySources: resolvedSources,
    },
  };
};
