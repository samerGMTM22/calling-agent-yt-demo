// GPT-Live engine (model gpt-live-1): full-duplex voice over wss://api.openai.com/v1/live/sessions.
//
// Twilio sends 8 kHz G.711 μ-law; GPT-Live accepts exactly that ("audio/pcmu", 8000),
// so audio passes straight through with no conversion in either direction.
// GPT-Live streams output in real time (including silence) and handles barge-in
// itself, so we just forward every delta to Twilio.
//
// Reasoning is delegated with `delegation: { type: "client" }`: when GPT-Live needs
// help it emits `session.delegation.created`, we ask the brain, and we hand the
// result back with `session.commentary.append` for GPT-Live to say.
import WebSocket from 'ws';
import { config } from '../config.js';
import { addTranscript } from '../calls.js';
import { askBrain } from '../brain.js';
import { buildInstructions, greetingInstruction } from '../persona.js';

const MAX_APPEND_CHARS = 1800; // appends are capped at 500 tokens

export function createLiveEngine({ call, sendAudio, endCall, log }) {
  const ws = new WebSocket('wss://api.openai.com/v1/live/sessions', {
    headers: { Authorization: `Bearer ${config.openaiApiKey}` },
  });
  let ready = false;
  let closing = false;
  const queued = [];
  let eventCounter = 0;
  const eid = (p) => `${p}_${++eventCounter}`;

  // Transcript deltas arrive in small pieces, and because GPT-Live is full-duplex the
  // agent's short back-channels ("mm-hm", "go ahead") interleave with the caller's
  // words. Buffer each speaker separately and write a line after a pause.
  const buffers = { caller: '', agent: '' };
  const timers = {};
  function flushRole(role) {
    clearTimeout(timers[role]);
    if (buffers[role]) addTranscript(call, role, buffers[role]);
    buffers[role] = '';
  }
  function flush() {
    flushRole('caller');
    flushRole('agent');
  }
  function onDelta(role, delta) {
    buffers[role] += delta;
    clearTimeout(timers[role]);
    timers[role] = setTimeout(() => flushRole(role), 1200);
  }

  function send(event) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  }

  ws.on('open', () => {
    send({
      type: 'session.start',
      event_id: eid('start'),
      session: {
        model: config.liveModel,
        instructions: buildInstructions(call),
        audio: { format: { type: 'audio/pcmu', rate: 8000 }, output: { voice: config.voice } },
        delegation: { type: 'client' },
      },
    });
  });

  ws.on('message', async (raw) => {
    let e;
    try { e = JSON.parse(raw); } catch { return; }
    switch (e.type) {
      case 'session.started':
        ready = true;
        log(`GPT-Live session started (${config.liveModel}, voice ${config.voice})`);
        for (const audio of queued.splice(0)) send({ type: 'session.input_audio.append', audio });
        // Make the agent speak first, with the AI disclosure.
        send({ type: 'session.instructions.append', event_id: eid('greet'), delegation_id: null, content: greetingInstruction(call) });
        break;
      case 'session.output_audio.delta':
        sendAudio(e.delta);
        break;
      case 'session.input_transcript.delta':
        onDelta('caller', e.delta);
        break;
      case 'session.output_transcript.delta':
        onDelta('agent', e.delta);
        break;
      case 'session.delegation.created':
        handleDelegation(e.delegation.id);
        break;
      case 'session.usage.updated':
        call.usageSeconds = e.usage?.seconds ?? call.usageSeconds;
        break;
      case 'session.closed':
        flush();
        log(`GPT-Live session closed (${e.reason})`);
        ws.close();
        break;
      case 'error':
        log(`GPT-Live error: ${e.error?.code || ''} ${e.error?.message || JSON.stringify(e)}`);
        break;
      default:
        break;
    }
  });

  async function handleDelegation(delegationId) {
    // The delegation event carries no text, so give the transcript a moment to
    // catch up, then use the caller's latest utterance. The brain also receives
    // the recent transcript for context.
    await new Promise((r) => setTimeout(r, 700));
    flushRole('caller');
    const question = call.transcript.filter((l) => l.role === 'caller').slice(-1)[0]?.text || 'The caller needs help.';
    log(`delegation → brain: "${question}"`);
    const answer = await askBrain(call, question);
    if (closing) return;
    send({
      type: 'session.commentary.append',
      event_id: eid('answer'),
      delegation_id: delegationId,
      content: answer.text.slice(0, MAX_APPEND_CHARS),
    });
    if (answer.hangup) setTimeout(() => endCall('brain requested hangup'), 12000);
  }

  ws.on('close', () => {
    if (!closing) {
      log('GPT-Live connection closed unexpectedly; ending the call.');
      endCall('ai disconnected');
    }
  });
  ws.on('error', (err) => log(`GPT-Live socket error: ${err.message}`));

  return {
    pushAudio(payload) {
      if (ready) send({ type: 'session.input_audio.append', audio: payload });
      else if (queued.length < 500) queued.push(payload);
    },
    // Live steering from the operator agent.
    say(text) {
      send({ type: 'session.commentary.append', event_id: eid('say'), delegation_id: null, content: text.slice(0, MAX_APPEND_CHARS) });
    },
    note(text) {
      send({ type: 'session.instructions.append', event_id: eid('note'), delegation_id: null, content: text.slice(0, MAX_APPEND_CHARS) });
    },
    close() {
      if (closing) return;
      closing = true;
      flush();
      if (ws.readyState === WebSocket.OPEN) {
        send({ type: 'session.close' });
        setTimeout(() => ws.terminate(), 3000);
      } else {
        ws.terminate();
      }
    },
  };
}
