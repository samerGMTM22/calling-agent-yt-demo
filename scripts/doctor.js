#!/usr/bin/env node
// Checks your setup step by step and tells you exactly what to fix.
//   npm run doctor
import fs from 'node:fs';
import { config, configProblems, configWarnings, maskPhone } from '../src/config.js';

let failures = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const bad = (msg, fix) => { failures += 1; console.log(`  ❌ ${msg}${fix ? `\n     → ${fix}` : ''}`); };
const warn = (msg) => console.log(`  ⚠️  ${msg}`);

console.log('\n1) .env file');
if (!fs.existsSync('.env')) bad('.env not found', 'Run: cp .env.example .env   then fill in your keys.');
else ok('.env exists');
for (const w of configWarnings()) warn(w);
const problems = configProblems();
if (problems.length) problems.forEach((p) => bad(p, 'Edit .env (see docs/en/01-openai.md and docs/en/02-twilio.md).'));
else ok('required keys look well-formed');

console.log('\n2) OpenAI');
try {
  for (const model of [config.voiceEngine === 'realtime' ? config.realtimeModel : config.liveModel, config.brain.openaiModel]) {
    const r = await fetch(`https://api.openai.com/v1/models/${model}`, { headers: { Authorization: `Bearer ${config.openaiApiKey}` } });
    if (r.ok) ok(`model ${model} is available to your key`);
    else if (r.status === 401) bad('OpenAI rejected the API key (401)', 'Create a new key at https://platform.openai.com/api-keys');
    else bad(`model ${model} not available (${r.status})`, 'Check billing/credits and organization verification on platform.openai.com.');
  }
} catch (e) { bad(`OpenAI unreachable: ${e.message}`); }

console.log('\n3) Twilio');
try {
  const { client, ourNumber } = await import('../src/twilio.js');
  const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });
  ok(`API key works; ${numbers.length} phone number(s) in the account`);
  const n = await ourNumber();
  ok(`agent number: ${maskPhone(n)}`);
} catch (e) { bad(`Twilio check failed: ${e.message}`, 'Check TWILIO_ACCOUNT_SID / TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET (docs/en/02-twilio.md).'); }

console.log('\n4) Safety settings');
if (config.ownerPhone) ok(`OWNER_PHONE_NUMBER set (${maskPhone(config.ownerPhone)})`);
else bad('OWNER_PHONE_NUMBER is empty', 'Set it to your own mobile number in E.164 format, e.g. +9715XXXXXXXX.');
if (config.allowedCallers.includes('*')) warn('ALLOWED_CALLERS=* → anyone can call your agent and spend your credits.');
else ok(`inbound allowlist: ${config.allowedCallers.map(maskPhone).join(', ') || '(empty: all inbound rejected)'}`);
if (config.allowedDestinations.includes('*')) warn('ALLOWED_DESTINATIONS=* → the agent may call any number.');
else ok(`outbound allowlist: ${config.allowedDestinations.map(maskPhone).join(', ') || '(empty: no outbound calls)'}`);
if (!config.twilio.authToken) warn('TWILIO_AUTH_TOKEN not set → webhooks are verified through the Twilio API instead of signatures (fine, slightly slower).');

console.log('\n5) Public tunnel (ngrok)');
try {
  const r = await fetch('http://127.0.0.1:4040/api/tunnels');
  const { tunnels } = await r.json();
  const t = tunnels.find((x) => x.public_url?.startsWith('https://'));
  if (t) ok(`ngrok running: ${t.public_url} → ${t.config?.addr}`);
  else warn('ngrok running but no https tunnel found');
} catch {
  if (config.publicUrl) ok(`PUBLIC_URL set: ${config.publicUrl}`);
  else warn('ngrok is not running yet (npm run up starts it for you).');
}

console.log(failures ? `\n${failures} problem(s) to fix.\n` : '\nAll good. Start with: npm run up\n');
process.exit(failures ? 1 : 0);
