// In-memory registry of calls + an event feed the operator agent can watch.
// Finished calls are saved as JSON in ./calls (gitignored: transcripts are personal data).
import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config, maskPhone } from './config.js';

const CALLS_DIR = path.resolve('calls');

export const bus = new EventEmitter();
bus.setMaxListeners(50);

// Ring buffer so a watcher that reconnects can catch up with `since`.
const history = [];
let seq = 0;

export function emit(type, data = {}) {
  const event = { seq: ++seq, at: new Date().toISOString(), type, ...data };
  history.push(event);
  if (history.length > 1000) history.shift();
  bus.emit('event', event);
  return event;
}

export function eventsSince(since = 0) {
  return history.filter((e) => e.seq > since);
}

export const calls = new Map();

export function newId(prefix) {
  return `${prefix}_${randomBytes(6).toString('hex')}`;
}

export function createCall({ direction, from, to, purpose = '', context = '', language = '' }) {
  const call = {
    id: newId('call'),
    direction,
    from,
    to,
    purpose,
    context,
    language,
    status: 'starting',
    twilioCallSid: null,
    // One-time secret that the Twilio media stream must present (see server.js).
    streamToken: randomBytes(24).toString('hex'),
    streamTokenExpiresAt: Date.now() + 3 * 60 * 1000,
    createdAt: new Date().toISOString(),
    endedAt: null,
    transcript: [],
    brain: [],
    usageSeconds: 0,
  };
  calls.set(call.id, call);
  emit('call.created', { callId: call.id, direction, purpose });
  return call;
}

export function activeCalls() {
  return [...calls.values()].filter((c) => !c.endedAt);
}

export function addTranscript(call, role, text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!/[\p{L}\p{N}]/u.test(clean)) return; // skip punctuation-only fragments
  const line = { role, text: clean, at: new Date().toISOString() };
  call.transcript.push(line);
  emit('transcript', { callId: call.id, role, text: clean });
}

export function setStatus(call, status) {
  if (call.status === status) return;
  call.status = status;
  emit('call.status', { callId: call.id, status });
}

export function endCall(call, reason = 'ended') {
  if (call.endedAt) return;
  call.endedAt = new Date().toISOString();
  call.status = 'completed';
  call.streamToken = null;
  emit('call.ended', { callId: call.id, reason, transcriptLines: call.transcript.length });
  saveCall(call);
}

export function saveCall(call) {
  if (!config.saveTranscripts) return;
  fs.mkdirSync(CALLS_DIR, { recursive: true });
  const { streamToken, _maxTimer, ...safe } = call;
  const file = path.join(CALLS_DIR, `${call.createdAt.slice(0, 10)}_${call.id}.json`);
  fs.writeFileSync(file, JSON.stringify(safe, null, 2));
}

// View used by the control API: no stream token, and phone numbers masked so they
// don't end up on screen recordings. Full numbers stay only in ./calls (git-ignored).
export function publicCall(call) {
  const { streamToken, streamTokenExpiresAt, _maxTimer, ...rest } = call;
  return { ...rest, from: maskPhone(call.from), to: maskPhone(call.to) };
}
