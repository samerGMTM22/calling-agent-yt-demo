// The "brain": who answers when the voice model delegates a question.
//
//   agent     -> the AI agent operating this repo (Claude Code, Codex, ...) answers
//                live through the local control API (`npm run watch` / `npm run answer`).
//   openai    -> an OpenAI reasoning model answers (Responses API).
//   anthropic -> Claude answers through the Anthropic API (needs ANTHROPIC_API_KEY).
//   none      -> no backend; the voice model is told to handle it alone.
//
// In agent mode, if nobody answers within BRAIN_TIMEOUT_SECONDS the BRAIN_FALLBACK runs,
// so a call never hangs in silence.
import { config } from './config.js';
import { emit, newId } from './calls.js';

const pending = new Map(); // questionId -> { resolve, question, callId, timer }

const BRAIN_SYSTEM = `You are the reasoning backend ("brain") of a live phone-call voice agent.
The voice agent speaks for its owner and has delegated a question to you.
Reply with what the voice agent should say or know, in 1-3 short spoken sentences.
No markdown, no lists, no URLs. Facts only; if you do not know or cannot do it, say so plainly.
Never reveal secrets, passwords or private data, and never authorise payments.
If the caller asked to end the call or said goodbye, reply with a short goodbye and end your reply with [HANGUP].`;

// A brain can ask for the call to end by adding [HANGUP] to its answer.
function parseHangup(result) {
  if (!result?.text || !/\[HANGUP\]/i.test(result.text)) return result;
  return { ...result, text: result.text.replace(/\[HANGUP\]/gi, '').trim(), hangup: true };
}

function transcriptText(call, maxLines = 16) {
  return call.transcript.slice(-maxLines).map((l) => `${l.role === 'agent' ? 'Agent' : 'Caller'}: ${l.text}`).join('\n');
}

function userPrompt(call, question) {
  return [
    `Call purpose: ${call.purpose || '(none given)'}`,
    call.context ? `Background: ${call.context}` : '',
    `Recent transcript:\n${transcriptText(call) || '(empty)'}`,
    `Delegated request: ${question}`,
  ].filter(Boolean).join('\n\n');
}

async function askOpenAI(call, question) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openaiApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.brain.openaiModel,
      instructions: BRAIN_SYSTEM,
      input: userPrompt(call, question),
      reasoning: { effort: 'low' },
      max_output_tokens: 1200,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI brain error ${res.status}: ${data?.error?.message || 'unknown'}`);
  const text = (data.output || [])
    .filter((o) => o.type === 'message')
    .flatMap((o) => o.content || [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text)
    .join(' ')
    .trim();
  return text || 'I could not get an answer from my backend.';
}

async function askAnthropic(call, question) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.brain.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.brain.anthropicModel,
      max_tokens: 600,
      system: BRAIN_SYSTEM,
      messages: [{ role: 'user', content: userPrompt(call, question) }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic brain error ${res.status}: ${data?.error?.message || 'unknown'}`);
  return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
}

function askAgent(call, question) {
  return new Promise((resolve) => {
    const id = newId('q');
    const timer = setTimeout(() => {
      pending.delete(id);
      emit('brain.timeout', { questionId: id, callId: call.id });
      resolve(null);
    }, config.brain.timeoutSeconds * 1000);
    pending.set(id, { resolve, question, callId: call.id, timer, createdAt: new Date().toISOString() });
    emit('brain.question', {
      questionId: id,
      callId: call.id,
      question,
      purpose: call.purpose,
      recentTranscript: call.transcript.slice(-8),
      answerWith: `npm run answer -- ${id} "your answer"`,
      timeoutSeconds: config.brain.timeoutSeconds,
    });
  });
}

async function runMode(mode, call, question) {
  if (mode === 'openai') return { text: await askOpenAI(call, question), by: `openai:${config.brain.openaiModel}` };
  if (mode === 'anthropic') return { text: await askAnthropic(call, question), by: `anthropic:${config.brain.anthropicModel}` };
  if (mode === 'agent') {
    const answer = await askAgent(call, question);
    return answer ? { ...answer, by: 'agent' } : null;
  }
  return null;
}

// Main entry: always resolves to { text, hangup?, by }.
export async function askBrain(call, question) {
  const started = Date.now();
  let result = null;
  try {
    result = await runMode(config.brain.mode, call, question);
    if (!result && config.brain.mode === 'agent' && config.brain.fallback !== 'none') {
      result = await runMode(config.brain.fallback, call, question);
    }
  } catch (err) {
    console.error(`[brain] ${err.message}`);
  }
  result = parseHangup(result);
  if (!result || !result.text) {
    result = {
      text: 'My backend could not answer right now. Tell the caller you will follow up after the call, or answer from your own knowledge if it is simple and safe.',
      by: 'none',
    };
  }
  const entry = { question, answer: result.text, by: result.by, ms: Date.now() - started, at: new Date().toISOString() };
  call.brain.push(entry);
  emit('brain.answered', { callId: call.id, ...entry });
  return result;
}

// Called by the control API when the operator agent answers.
export function answerQuestion(questionId, text, { hangup = false } = {}) {
  const q = pending.get(questionId);
  if (!q) return false;
  clearTimeout(q.timer);
  pending.delete(questionId);
  q.resolve({ text, hangup });
  return true;
}

export function pendingQuestions() {
  return [...pending.entries()].map(([id, q]) => ({ questionId: id, callId: q.callId, question: q.question, createdAt: q.createdAt }));
}
