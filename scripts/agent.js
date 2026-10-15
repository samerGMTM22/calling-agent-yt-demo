#!/usr/bin/env node
// Command-line remote for the running server's local control API.
// This is the interface an AI agent (Claude Code, Codex, ...) uses to place calls
// and act as the "brain" during a call.
//
//   npm run call -- --to +15551234567 --purpose "..." [--context "..."] [--language ar|en]
//   npm run watch                      stream live events (transcripts, brain questions)
//   npm run answer -- <questionId> "answer text" [--hangup]
//   npm run say -- <callId> "tell them this now"
//   npm run note -- <callId> "silent context for the voice agent"
//   npm run hangup -- <callId>
//   npm run calls                      list calls
//   npm run transcript -- <callId>     full record of one call
//   npm run status                     engine, brain, URLs, allowlists
import fs from 'node:fs';
import { config } from '../src/config.js';

const BASE = `http://127.0.0.1:${config.controlPort}`;
const [cmd, ...rest] = process.argv.slice(2);

// The running server writes a fresh secret here each time it starts.
function token() {
  try {
    return fs.readFileSync('data/control-token', 'utf8').trim();
  } catch {
    return '';
  }
}

function flags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i += 1; }
    } else out._.push(args[i]);
  }
  return out;
}

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'X-Control-Token': token(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    console.error(`Cannot reach the server on ${BASE}. Start it first: npm run up`);
    process.exit(2);
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data;
}

const print = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));

async function watch() {
  let since = 0;
  let boot = '';
  let warned = false;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/events?since=${since}&boot=${boot}`, { headers: { 'X-Control-Token': token() } });
      if (res.status === 401) throw new Error('token');
      const newBoot = res.headers.get('x-boot-id') || '';
      if (newBoot !== boot) since = 0; // server restarted: its event numbers start over
      boot = newBoot;
      warned = false;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const e = JSON.parse(line);
          since = e.seq;
          console.log(line);
        }
      }
    } catch {
      if (!warned) console.error('(waiting for the server: is npm run up running in this project folder?)');
      warned = true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const f = flags(rest);
switch (cmd) {
  case 'call':
    print(await api('POST', '/calls', { to: f.to, purpose: f.purpose, context: f.context, language: f.language }));
    break;
  case 'watch':
    await watch();
    break;
  case 'answer':
    if (f._.length < 2) { console.error('usage: npm run answer -- <questionId> "answer text" [--hangup]'); process.exit(1); }
    print(await api('POST', '/brain/answer', { questionId: f._[0], text: f._.slice(1).join(' '), hangup: Boolean(f.hangup) }));
    break;
  case 'say':
  case 'note':
    if (f._.length < 2) { console.error(`usage: npm run ${cmd} -- <callId> "text"`); process.exit(1); }
    print(await api('POST', `/calls/${f._[0]}/${cmd}`, { text: f._.slice(1).join(' ') }));
    break;
  case 'hangup':
    print(await api('POST', `/calls/${f._[0]}/hangup`));
    break;
  case 'calls':
    print(await api('GET', '/calls'));
    break;
  case 'transcript': {
    const call = await api('GET', `/calls/${f._[0]}`);
    if (f.json) print(call);
    else {
      console.log(`${call.direction} call ${call.id}: ${call.status}${call.purpose ? ` | purpose: ${call.purpose}` : ''}`);
      for (const l of call.transcript) console.log(`${l.role === 'agent' ? 'AGENT ' : 'CALLER'}: ${l.text}`);
      for (const b of call.brain) console.log(`[brain ${b.by}, ${b.ms}ms] Q: ${b.question} → A: ${b.answer}`);
    }
    break;
  }
  case 'status':
    print(await api('GET', '/status'));
    break;
  default:
    console.log('Commands: call, watch, answer, say, note, hangup, calls, transcript, status (see scripts/agent.js header).');
}
