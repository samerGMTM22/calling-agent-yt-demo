// Realtime engine (model gpt-realtime-2.1): turn-based speech-to-speech over
// wss://api.openai.com/v1/realtime. Use it with VOICE_ENGINE=realtime.
//
// Audio is G.711 μ-law both ways ("audio/pcmu"), matching Twilio. Over WebSocket we
// own playback, so barge-in works like Twilio's reference sample: when the caller
// starts talking we truncate the assistant item and tell Twilio to clear its buffer.
// The brain is reached through an `ask_brain` function tool.
import WebSocket from 'ws';
import { config } from '../config.js';
import { addTranscript } from '../calls.js';
import { askBrain } from '../brain.js';
import { buildInstructions, greetingInstruction } from '../persona.js';

const TOOLS = [
  {
    type: 'function',
    name: 'ask_brain',
    description: 'Ask your backend brain (a more capable AI agent supervising this call) for facts, decisions, current information, or anything about the owner. Say a short filler like "let me check" before calling.',
    parameters: {
      type: 'object',
      properties: { question: { type: 'string', description: 'The exact question or task, with any details the caller gave.' } },
      required: ['question'],
    },
  },
  {
    type: 'function',
    name: 'end_call',
    description: 'Hang up after you have said goodbye, or when the person asks to end the call.',
    parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: [] },
  },
];

export function createRealtimeEngine({ call, sendAudio, clearAudio, sendMark, endCall, log }) {
  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.realtimeModel)}`, {
    headers: { Authorization: `Bearer ${config.openaiApiKey}` },
  });
  let ready = false;
  let closing = false;
  let hangupAfterResponse = false;
  const queued = [];

  // Playback tracking for interruption handling.
  let latestMediaTimestamp = 0;
  let responseStartTimestamp = null;
  let lastAssistantItem = null;
  let marksPending = 0;

  function send(event) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  }

  ws.on('open', () => {
    send({
      type: 'session.update',
      session: {
        type: 'realtime',
        model: config.realtimeModel,
        output_modalities: ['audio'],
        instructions: buildInstructions(call),
        audio: {
          input: {
            format: { type: 'audio/pcmu' },
            noise_reduction: { type: 'near_field' },
            transcription: { model: 'gpt-4o-mini-transcribe' },
            turn_detection: { type: 'semantic_vad', eagerness: 'auto', create_response: true, interrupt_response: true },
          },
          output: { format: { type: 'audio/pcmu' }, voice: config.voice },
        },
        tools: TOOLS,
        tool_choice: 'auto',
      },
    });
  });

  ws.on('message', async (raw) => {
    let e;
    try { e = JSON.parse(raw); } catch { return; }
    switch (e.type) {
      case 'session.updated':
        if (!ready) {
          ready = true;
          log(`Realtime session ready (${config.realtimeModel}, voice ${config.voice})`);
          for (const audio of queued.splice(0)) send({ type: 'input_audio_buffer.append', audio });
          send({ type: 'response.create', response: { instructions: greetingInstruction(call) } });
        }
        break;
      case 'response.output_audio.delta':
        if (responseStartTimestamp === null) responseStartTimestamp = latestMediaTimestamp;
        if (e.item_id) lastAssistantItem = e.item_id;
        sendAudio(e.delta);
        sendMark();
        marksPending += 1;
        break;
      case 'input_audio_buffer.speech_started':
        interrupt();
        break;
      case 'conversation.item.input_audio_transcription.completed':
        addTranscript(call, 'caller', e.transcript || '');
        break;
      case 'response.output_audio_transcript.done':
        addTranscript(call, 'agent', e.transcript || '');
        break;
      case 'response.done':
        await handleResponseDone(e.response);
        break;
      case 'error':
        log(`Realtime error: ${e.error?.code || ''} ${e.error?.message || JSON.stringify(e)}`);
        break;
      default:
        break;
    }
  });

  function interrupt() {
    if (marksPending > 0 && lastAssistantItem && responseStartTimestamp !== null) {
      send({
        type: 'conversation.item.truncate',
        item_id: lastAssistantItem,
        content_index: 0,
        audio_end_ms: Math.max(0, latestMediaTimestamp - responseStartTimestamp),
      });
      clearAudio();
    }
    marksPending = 0;
    lastAssistantItem = null;
    responseStartTimestamp = null;
  }

  async function handleResponseDone(response) {
    const calls = (response?.output || []).filter((o) => o.type === 'function_call');
    if (calls.length === 0) {
      if (hangupAfterResponse) setTimeout(() => endCall('agent ended the call'), 4000);
      return;
    }
    for (const fc of calls) {
      let args = {};
      try { args = JSON.parse(fc.arguments || '{}'); } catch { /* keep empty */ }
      let output;
      if (fc.name === 'ask_brain') {
        log(`ask_brain → "${args.question}"`);
        const answer = await askBrain(call, args.question || '');
        output = { answer: answer.text };
        if (answer.hangup) hangupAfterResponse = true;
      } else if (fc.name === 'end_call') {
        hangupAfterResponse = true;
        output = { ok: true, note: 'Say a short goodbye now; the line will close after it.' };
      } else {
        output = { error: `unknown tool ${fc.name}` };
      }
      if (closing) return;
      send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: fc.call_id, output: JSON.stringify(output) } });
    }
    send({ type: 'response.create' });
  }

  ws.on('close', () => {
    if (!closing) {
      log('Realtime connection closed unexpectedly; ending the call.');
      endCall('ai disconnected');
    }
  });
  ws.on('error', (err) => log(`Realtime socket error: ${err.message}`));

  return {
    pushAudio(payload, timestamp) {
      if (timestamp !== undefined) latestMediaTimestamp = Number(timestamp);
      if (ready) send({ type: 'input_audio_buffer.append', audio: payload });
      else if (queued.length < 500) queued.push(payload);
    },
    onMark() {
      if (marksPending > 0) marksPending -= 1;
    },
    say(text) {
      send({ type: 'response.create', response: { instructions: `Tell the person this now, in your own words: ${text}` } });
    },
    note(text) {
      send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text }] } });
    },
    close() {
      if (closing) return;
      closing = true;
      ws.close();
    },
  };
}
