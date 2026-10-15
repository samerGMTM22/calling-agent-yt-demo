// Two servers in one process:
//
//  1. PUBLIC  (PORT, exposed through ngrok): only Twilio talks to it.
//     POST /twilio/voice   incoming calls: caller allowlist (+ optional PIN), then TwiML to stream audio
//     POST /twilio/pin     keypad PIN check, when INBOUND_PIN is set
//     POST /twilio/status  call status updates
//     WS   /media-stream   live call audio <-> OpenAI voice engine
//
//  2. CONTROL (127.0.0.1:CONTROL_PORT, never exposed): the operator agent's API.
//     Place calls, watch events, answer delegated questions, steer or end calls.
//     Every request needs the per-run token in data/control-token; browsers are refused.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { config, configProblems, configWarnings, maskPhone, normalizePhone } from './config.js';
import {
  activeCalls, bus, calls, createCall, emit, endCall, eventsSince, publicCall, setStatus,
} from './calls.js';
import { answerQuestion, pendingQuestions } from './brain.js';
import {
  hangup, ourNumber, pinTwiml, placeCall, publicUrl, rejectTwiml, sayAndHangupTwiml, streamTwiml, verifyWebhook,
} from './twilio.js';
import { createLiveEngine } from './engines/live.js';
import { createRealtimeEngine } from './engines/realtime.js';

const engines = new Map(); // callId -> engine
const pinAttempts = new Map(); // Twilio CallSid -> wrong PIN attempts
const BOOT_ID = Date.now().toString(36);

// Per-run secret for the control API, readable only by your user account.
// Blocks other web pages (CSRF) and anything that can't read your files.
const CONTROL_TOKEN = randomBytes(24).toString('hex');
const TOKEN_FILE = path.resolve('data', 'control-token');
fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
fs.writeFileSync(TOKEN_FILE, CONTROL_TOKEN, { mode: 0o600 });
fs.chmodSync(TOKEN_FILE, 0o600);

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Twilio sends a handful of requests per call; anything far above that is abuse.
let rateWindowStart = Date.now();
let rateCount = 0;
function rateLimited() {
  const now = Date.now();
  if (now - rateWindowStart > 60_000) { rateWindowStart = now; rateCount = 0; }
  rateCount += 1;
  return rateCount > 120;
}

function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function reply(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
}

function isAllowed(list, number) {
  return list.includes('*') || list.includes(number);
}

// Ends a call everywhere: Twilio leg, AI session, registry.
async function finishCall(call, reason) {
  if (!call || call.endedAt) return;
  const engine = engines.get(call.id);
  engines.delete(call.id);
  engine?.close();
  clearTimeout(call._maxTimer);
  await hangup(call.twilioCallSid);
  endCall(call, reason);
  log(`[${call.id}] ended: ${reason}`);
}

// ---------------------------------------------------------------- public server

// Handles both the first webhook (/twilio/voice) and the PIN step (/twilio/pin).
async function handleTwilioVoice(req, res, url) {
  const params = Object.fromEntries(new URLSearchParams(await readBody(req)));
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${proto}://${host}`;

  const genuine = await verifyWebhook({ signature: req.headers['x-twilio-signature'], url: `${baseUrl}${req.url}`, params });
  if (!genuine) {
    log(`Blocked a ${url.pathname} request that did not come from Twilio.`);
    return reply(res, 403, 'forbidden', 'text/plain');
  }

  const from = normalizePhone(params.From);
  if (!isAllowed(config.allowedCallers, from)) {
    log(`Rejected inbound call from ${maskPhone(from)} (not in ALLOWED_CALLERS).`);
    emit('call.rejected', { from: maskPhone(from), reason: 'not allowlisted' });
    return reply(res, 200, rejectTwiml(), 'text/xml');
  }

  // Caller ID can be faked, so INBOUND_PIN adds something only you know.
  if (url.pathname === '/twilio/pin') {
    if (!config.inboundPin) return reply(res, 404, 'not found', 'text/plain');
    const tries = (pinAttempts.get(params.CallSid) || 0) + 1;
    pinAttempts.set(params.CallSid, tries);
    setTimeout(() => pinAttempts.delete(params.CallSid), 10 * 60_000);
    if (!safeEqual(params.Digits || '', config.inboundPin)) {
      log(`Wrong PIN from ${maskPhone(from)} (attempt ${tries} of 3).`);
      emit('call.rejected', { from: maskPhone(from), reason: 'wrong PIN' });
      return reply(res, 200, tries >= 3 ? sayAndHangupTwiml('Goodbye.') : pinTwiml(baseUrl, config.inboundPin.length, true), 'text/xml');
    }
    pinAttempts.delete(params.CallSid);
  } else if (config.inboundPin) {
    return reply(res, 200, pinTwiml(baseUrl, config.inboundPin.length, false), 'text/xml');
  }

  if (activeCalls().length >= config.maxConcurrentCalls) {
    return reply(res, 200, sayAndHangupTwiml('Sorry, the agent is busy on another call. Please try again later.'), 'text/xml');
  }

  const call = createCall({ direction: 'inbound', from, to: normalizePhone(params.To) });
  call.twilioCallSid = params.CallSid;
  log(`[${call.id}] inbound call from ${maskPhone(from)} accepted`);
  reply(res, 200, streamTwiml(baseUrl, call), 'text/xml');
}

async function handleTwilioStatus(req, res, url) {
  const params = Object.fromEntries(new URLSearchParams(await readBody(req)));
  const call = calls.get(url.searchParams.get('callId'));
  if (!call || (call.twilioCallSid && call.twilioCallSid !== params.CallSid)) return reply(res, 403, 'forbidden', 'text/plain');
  if (!call.twilioCallSid) call.twilioCallSid = params.CallSid;
  const status = params.CallStatus;
  if (['busy', 'no-answer', 'failed', 'canceled', 'completed'].includes(status)) {
    await finishCall(call, status);
  } else if (!call.endedAt) {
    setStatus(call, status);
  }
  reply(res, 204, '');
}

const publicServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return reply(res, 200, { ok: true, service: 'calling-agent' });
    }
    if (req.method === 'POST' && url.pathname.startsWith('/twilio/') && rateLimited()) return reply(res, 429, 'slow down', 'text/plain');
    if (req.method === 'POST' && (url.pathname === '/twilio/voice' || url.pathname === '/twilio/pin')) return await handleTwilioVoice(req, res, url);
    if (req.method === 'POST' && url.pathname === '/twilio/status') return await handleTwilioStatus(req, res, url);
    reply(res, 404, 'not found', 'text/plain');
  } catch (err) {
    log(`public error: ${err.message}`);
    reply(res, 500, 'error', 'text/plain');
  }
});

// Twilio media stream <-> voice engine
// Twilio media frames are tiny (~20 ms of audio); cap message size to stop memory abuse.
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
publicServer.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://localhost').pathname !== '/media-stream') return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', (twilioWs) => {
  let call = null;
  let engine = null;
  let streamSid = null;
  let markCount = 0;

  const toTwilio = (msg) => { if (twilioWs.readyState === 1) twilioWs.send(JSON.stringify(msg)); };
  // Without this, one oversized or malformed frame from anyone would crash the whole server.
  twilioWs.on('error', (err) => log(`Media socket error: ${err.message}`));
  // Unauthenticated sockets get 5 seconds to present a valid token.
  const authTimer = setTimeout(() => { if (!engine) twilioWs.close(); }, 5000);

  twilioWs.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.event === 'start') {
      const p = msg.start?.customParameters || {};
      const candidate = calls.get(p.callId);
      const valid = candidate && !candidate.endedAt && candidate.streamToken
        && safeEqual(p.token || '', candidate.streamToken) && Date.now() < candidate.streamTokenExpiresAt
        && !engines.has(candidate.id);
      if (!valid) {
        log('Rejected a media stream with a missing/invalid token.');
        return twilioWs.close();
      }
      clearTimeout(authTimer);
      call = candidate;
      call.streamToken = null; // one-time use
      call.twilioCallSid = call.twilioCallSid || msg.start.callSid;
      streamSid = msg.start.streamSid;
      setStatus(call, 'in-progress');

      const callLog = (text) => log(`[${call.id}] ${text}`);
      const deps = {
        call,
        log: callLog,
        sendAudio: (payload) => toTwilio({ event: 'media', streamSid, media: { payload } }),
        clearAudio: () => toTwilio({ event: 'clear', streamSid }),
        sendMark: () => toTwilio({ event: 'mark', streamSid, mark: { name: `m${++markCount}` } }),
        endCall: (reason) => finishCall(call, reason),
      };
      engine = config.voiceEngine === 'realtime' ? createRealtimeEngine(deps) : createLiveEngine(deps);
      engines.set(call.id, engine);
      call._maxTimer = setTimeout(() => finishCall(call, 'max duration reached'), config.maxCallSeconds * 1000);
      callLog(`media stream connected → ${config.voiceEngine} engine, brain=${config.brain.mode}`);
      return;
    }
    if (!engine) return;
    if (msg.event === 'media' && msg.media?.track !== 'outbound') engine.pushAudio(msg.media.payload, msg.media.timestamp);
    else if (msg.event === 'mark') engine.onMark?.();
    else if (msg.event === 'stop') finishCall(call, 'caller hung up');
  });

  twilioWs.on('close', () => {
    clearTimeout(authTimer);
    if (call) finishCall(call, 'stream closed');
  });
});

// --------------------------------------------------------------- control server

async function handleControl(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const json = async () => { const b = await readBody(req); return b ? JSON.parse(b) : {}; };

  if (req.method === 'GET' && url.pathname === '/status') {
    let number = null; let pub = null;
    try { number = maskPhone(await ourNumber()); } catch (e) { number = `error: ${e.message}`; }
    try { pub = await publicUrl(); } catch (e) { pub = `error: ${e.message}`; }
    return reply(res, 200, {
      engine: config.voiceEngine === 'realtime' ? config.realtimeModel : config.liveModel,
      voice: config.voice,
      brain: config.brain.mode,
      brainFallback: config.brain.fallback,
      twilioNumber: number,
      publicUrl: pub,
      inboundWebhook: typeof pub === 'string' && pub.startsWith('http') ? `${pub}/twilio/voice` : null,
      allowedCallers: config.allowedCallers.map(maskPhone),
      allowedDestinations: config.allowedDestinations.map((n) => (n === '*' ? 'ANY (*)' : maskPhone(n))),
      activeCalls: activeCalls().map((c) => ({ id: c.id, direction: c.direction, status: c.status })),
      pendingQuestions: pendingQuestions(),
    });
  }

  if (req.method === 'POST' && url.pathname === '/calls') {
    const body = await json();
    const to = normalizePhone(body.to || config.ownerPhone);
    if (!to) return reply(res, 400, { error: 'No destination: pass "to" or set OWNER_PHONE_NUMBER.' });
    if (!isAllowed(config.allowedDestinations, to)) {
      return reply(res, 403, { error: `${maskPhone(to)} is not in ALLOWED_DESTINATIONS. Add it to .env on purpose if you really mean to call it.` });
    }
    if (activeCalls().length >= config.maxConcurrentCalls) return reply(res, 429, { error: 'Too many active calls.' });
    const baseUrl = await publicUrl();
    const call = createCall({
      direction: 'outbound', from: await ourNumber(), to,
      purpose: body.purpose || '', context: body.context || '', language: body.language || '',
    });
    try {
      call.twilioCallSid = await placeCall(call, baseUrl);
      setStatus(call, 'dialing');
      log(`[${call.id}] calling ${maskPhone(to)}…`);
      return reply(res, 201, publicCall(call));
    } catch (err) {
      endCall(call, `twilio error: ${err.message}`);
      return reply(res, 502, { error: err.message, code: err.code, moreInfo: err.moreInfo });
    }
  }

  if (req.method === 'GET' && url.pathname === '/calls') {
    return reply(res, 200, [...calls.values()].map((c) => ({
      id: c.id, direction: c.direction, status: c.status, createdAt: c.createdAt, endedAt: c.endedAt, purpose: c.purpose, lines: c.transcript.length,
    })));
  }

  if (parts[0] === 'calls' && parts[1]) {
    const call = calls.get(parts[1]);
    if (!call) return reply(res, 404, { error: 'unknown call id' });
    if (req.method === 'GET' && !parts[2]) return reply(res, 200, publicCall(call));
    const engine = engines.get(call.id);
    if (req.method === 'POST' && parts[2] === 'hangup') { await finishCall(call, 'hung up by operator'); return reply(res, 200, { ok: true }); }
    if (req.method === 'POST' && (parts[2] === 'say' || parts[2] === 'note')) {
      if (!engine) return reply(res, 409, { error: 'call is not live' });
      const { text } = await json();
      engine[parts[2]](String(text || ''));
      emit(`operator.${parts[2]}`, { callId: call.id, text });
      return reply(res, 200, { ok: true });
    }
  }

  if (req.method === 'GET' && url.pathname === '/brain/pending') return reply(res, 200, pendingQuestions());
  if (req.method === 'POST' && url.pathname === '/brain/answer') {
    const { questionId, text, hangup: hang } = await json();
    const ok = answerQuestion(questionId, String(text || ''), { hangup: Boolean(hang) });
    return reply(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'unknown or expired question id' });
  }

  // Newline-delimited JSON event stream (one event per line), for `npm run watch`.
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache', 'X-Boot-Id': BOOT_ID });
    // `since` only makes sense for the same server run; after a restart, replay everything.
    const since = url.searchParams.get('boot') === BOOT_ID ? Number(url.searchParams.get('since') || 0) : 0;
    for (const e of eventsSince(since)) res.write(`${JSON.stringify(e)}\n`);
    const onEvent = (e) => res.write(`${JSON.stringify(e)}\n`);
    bus.on('event', onEvent);
    const ping = setInterval(() => res.write('\n'), 20000);
    req.on('close', () => { bus.off('event', onEvent); clearInterval(ping); });
    return undefined;
  }

  return reply(res, 404, { error: 'not found' });
}

const controlServer = http.createServer(async (req, res) => {
  // Only accept local requests addressed to localhost (blocks DNS-rebinding tricks).
  const host = (req.headers.host || '').split(':')[0];
  if (!['127.0.0.1', 'localhost'].includes(host)) return reply(res, 403, { error: 'local only' });
  // Web pages always send an Origin header; the CLI never does. Refuse browsers outright.
  if (req.headers.origin) return reply(res, 403, { error: 'browser requests are not allowed' });
  if (!safeEqual(req.headers['x-control-token'] || '', CONTROL_TOKEN)) {
    return reply(res, 401, { error: 'missing or wrong control token: use the npm run commands from the project folder' });
  }
  try {
    await handleControl(req, res, new URL(req.url, 'http://localhost'));
  } catch (err) {
    log(`control error: ${err.message}`);
    if (!res.headersSent) reply(res, 500, { error: err.message });
  }
});

// ----------------------------------------------------------------------- start

const problems = configProblems();
for (const w of configWarnings()) log(`warning: ${w}`);
if (problems.length) {
  console.error('\nConfiguration problems (fix .env, see .env.example):');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
if (config.allowedCallers.length === 0) log('warning: ALLOWED_CALLERS is empty → every inbound call will be rejected.');
if (config.allowedDestinations.includes('*')) log('warning: ALLOWED_DESTINATIONS=* → the agent may call ANY number. Be careful.');
if (!config.inboundPin && config.allowedCallers.length) log('tip: set INBOUND_PIN in .env so a faked caller ID alone cannot reach your agent.');

publicServer.listen(config.port, () => {
  controlServer.listen(config.controlPort, '127.0.0.1', async () => {
    log(`Public server   http://localhost:${config.port}  (expose with: npm run tunnel)`);
    log(`Control API     http://127.0.0.1:${config.controlPort}  (local only)`);
    log(`Voice engine    ${config.voiceEngine === 'realtime' ? config.realtimeModel : config.liveModel}, voice ${config.voice}`);
    log(`Brain           ${config.brain.mode}${config.brain.mode === 'agent' ? ` (fallback: ${config.brain.fallback} after ${config.brain.timeoutSeconds}s)` : ''}`);
    log(`Agent           ${config.agentName}, ${config.ownerName}'s AI agent | persona: ${fs.existsSync(config.personaFile) ? config.personaFile : 'default (no persona.md)'}`);
    try {
      const pub = await publicUrl();
      log(`Public URL      ${pub}`);
      log(`Inbound webhook ${pub}/twilio/voice   (npm run twilio:connect sets it)`);
      if (/\d+-\d+-\d+-\d+\.ngrok/.test(pub)) {
        log('privacy: this ngrok address contains your public IP. Don\'t show or share it; set NGROK_DOMAIN to a free static domain instead.');
      }
    } catch (e) {
      log(`Public URL      not found yet: ${e.message}`);
    }
  });
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    log('Shutting down: ending live calls…');
    await Promise.all(activeCalls().map((c) => finishCall(c, 'server stopped')));
    process.exit(0);
  });
}
