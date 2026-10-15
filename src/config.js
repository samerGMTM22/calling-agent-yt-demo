// Loads and validates settings from .env.
// Secrets are read here once and never logged.
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const warnings = [];

// People often paste values copied from JSON or a dashboard, e.g. "AC123...",
// with quotes or a trailing comma. Clean that up instead of failing mysteriously.
function clean(name) {
  const raw = process.env[name];
  if (raw === undefined) return '';
  const value = raw.trim().replace(/,+$/, '').replace(/^["']|["']$/g, '').trim();
  if (value !== raw.trim()) warnings.push(`${name} had extra quotes/commas around it; they were ignored.`);
  return value;
}

export function normalizePhone(value) {
  if (!value) return '';
  const digits = String(value).replace(/[\s\-().]/g, '');
  if (/^00\d+$/.test(digits)) return `+${digits.slice(2)}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function phoneList(name, fallback = []) {
  const value = clean(name);
  if (!value) return fallback;
  if (value === '*') return ['*'];
  return value.split(',').map((n) => normalizePhone(n)).filter(Boolean);
}

function int(name, fallback) {
  const n = Number.parseInt(clean(name), 10);
  return Number.isFinite(n) ? n : fallback;
}

const ownerPhone = normalizePhone(clean('OWNER_PHONE_NUMBER'));
const allowedCallers = phoneList('ALLOWED_CALLERS', ownerPhone ? [ownerPhone] : []);

export const config = {
  openaiApiKey: clean('OPENAI_API_KEY'),

  twilio: {
    accountSid: clean('TWILIO_ACCOUNT_SID'),
    apiKeySid: clean('TWILIO_API_KEY_SID'),
    apiKeySecret: clean('TWILIO_API_KEY_SECRET'),
    authToken: clean('TWILIO_AUTH_TOKEN'), // optional: enables webhook signature checks
    phoneNumber: normalizePhone(clean('TWILIO_PHONE_NUMBER')),
  },

  agentName: clean('AGENT_NAME') || 'Sam',
  ownerName: clean('OWNER_NAME') || 'my owner',
  ownerPhone,
  allowedCallers,
  allowedDestinations: phoneList('ALLOWED_DESTINATIONS', allowedCallers),
  agentLanguage: (clean('AGENT_LANGUAGE') || 'auto').toLowerCase(),

  voiceEngine: (clean('VOICE_ENGINE') || 'live').toLowerCase(),
  voice: clean('OPENAI_VOICE') || 'marin',
  liveModel: clean('LIVE_MODEL') || 'gpt-live-1',
  realtimeModel: clean('REALTIME_MODEL') || 'gpt-realtime-2.1',

  brain: {
    mode: (clean('BRAIN_MODE') || 'agent').toLowerCase(),
    fallback: (clean('BRAIN_FALLBACK') || 'openai').toLowerCase(),
    timeoutSeconds: int('BRAIN_TIMEOUT_SECONDS', 30),
    openaiModel: clean('OPENAI_BRAIN_MODEL') || 'gpt-5.6-terra',
    anthropicApiKey: clean('ANTHROPIC_API_KEY'),
    anthropicModel: clean('ANTHROPIC_MODEL') || 'claude-sonnet-5-5',
  },

  port: int('PORT', 3000),
  controlPort: int('CONTROL_PORT', 3001),
  publicUrl: clean('PUBLIC_URL').replace(/\/+$/, ''),
  maxCallSeconds: int('MAX_CALL_SECONDS', 600),
  maxConcurrentCalls: int('MAX_CONCURRENT_CALLS', 2),
  saveTranscripts: clean('SAVE_TRANSCRIPTS') !== 'false',
};

export function configWarnings() {
  return [...new Set(warnings)];
}

// Returns a list of human-readable problems. Empty list = good to go.
export function configProblems() {
  const p = [];
  if (!config.openaiApiKey.startsWith('sk-')) p.push('OPENAI_API_KEY is missing or does not start with "sk-".');
  if (!/^AC[0-9a-f]{32}$/.test(config.twilio.accountSid)) p.push('TWILIO_ACCOUNT_SID is missing or malformed (should look like AC + 32 hex characters).');
  if (!/^SK[0-9a-f]{32}$/.test(config.twilio.apiKeySid)) p.push('TWILIO_API_KEY_SID is missing or malformed (should look like SK + 32 hex characters).');
  if (!config.twilio.apiKeySecret) p.push('TWILIO_API_KEY_SECRET is missing.');
  if (!['live', 'realtime'].includes(config.voiceEngine)) p.push('VOICE_ENGINE must be "live" or "realtime".');
  if (!['agent', 'openai', 'anthropic', 'none'].includes(config.brain.mode)) p.push('BRAIN_MODE must be agent, openai, anthropic or none.');
  if (config.brain.mode === 'anthropic' && !config.brain.anthropicApiKey) p.push('BRAIN_MODE=anthropic needs ANTHROPIC_API_KEY.');
  return p;
}

// For logs: +15551234567 -> +15•••4567
export function maskPhone(n) {
  if (!n) return '(unknown)';
  return n.length > 7 ? `${n.slice(0, 3)}•••${n.slice(-4)}` : '•••';
}
