// Everything that talks to Twilio's REST API.
// Auth uses an API Key (SK...) + secret, never the account's master Auth Token.
import twilio from 'twilio';
import { config } from './config.js';

export const client = twilio(config.twilio.apiKeySid, config.twilio.apiKeySecret, {
  accountSid: config.twilio.accountSid,
});

let cachedNumber = config.twilio.phoneNumber;

// If TWILIO_PHONE_NUMBER is not set and the account owns exactly one number, use it.
export async function ourNumber() {
  if (cachedNumber) return cachedNumber;
  const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });
  if (numbers.length === 1) cachedNumber = numbers[0].phoneNumber;
  else if (numbers.length === 0) throw new Error('This Twilio account has no phone number yet. Buy one first (see docs).');
  else throw new Error('Several Twilio numbers found: set TWILIO_PHONE_NUMBER in .env to pick one.');
  return cachedNumber;
}

// Public HTTPS URL of this server: PUBLIC_URL, or the running ngrok tunnel.
export async function publicUrl() {
  if (config.publicUrl) return config.publicUrl;
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels');
    const { tunnels } = await res.json();
    const t = tunnels.find((x) => x.public_url?.startsWith('https://') && x.config?.addr?.endsWith(`:${config.port}`))
      || tunnels.find((x) => x.public_url?.startsWith('https://'));
    if (t) return t.public_url.replace(/\/+$/, '');
  } catch { /* ngrok not running */ }
  throw new Error('No public URL. Start ngrok (`npm run tunnel`) or set PUBLIC_URL in .env.');
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

// TwiML that bridges the call audio to our WebSocket. The token travels as a
// <Parameter> (Twilio does not allow query strings on <Stream> URLs).
export function streamTwiml(baseUrl, call) {
  const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/media-stream`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(wsUrl)}">
      <Parameter name="callId" value="${escapeXml(call.id)}" />
      <Parameter name="token" value="${escapeXml(call.streamToken)}" />
    </Stream>
  </Connect>
</Response>`;
}

export function rejectTwiml() {
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="rejected" /></Response>';
}

// Asks the caller to type INBOUND_PIN on the keypad; Twilio posts the digits to /twilio/pin.
export function pinTwiml(baseUrl, digits, retry) {
  const prompt = retry ? 'Wrong PIN. Please try again.' : 'Please enter your PIN.';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="${digits}" timeout="10" action="${escapeXml(`${baseUrl}/twilio/pin`)}" method="POST">
    <Say>${prompt}</Say>
  </Gather>
  <Say>Goodbye.</Say>
  <Hangup />
</Response>`;
}

export function sayAndHangupTwiml(text) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(text)}</Say><Hangup /></Response>`;
}

export async function placeCall(call, baseUrl) {
  const from = await ourNumber();
  const created = await client.calls.create({
    to: call.to,
    from,
    twiml: streamTwiml(baseUrl, call),
    timeLimit: config.maxCallSeconds,
    statusCallback: `${baseUrl}/twilio/status?callId=${encodeURIComponent(call.id)}`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
  });
  return created.sid;
}

export async function hangup(callSid) {
  if (!callSid) return;
  try {
    await client.calls(callSid).update({ status: 'completed' });
  } catch (err) {
    // 404 / 21220 = the call already ended on Twilio's side, which is fine.
    if (err.status !== 404 && err.code !== 21220) console.error(`[twilio] hangup failed: ${err.message}`);
  }
}

// Webhook authenticity.
// 1) If TWILIO_AUTH_TOKEN is set: verify Twilio's HMAC signature (strongest).
// 2) Otherwise: confirm with Twilio's API that this CallSid is real, live, and
//    really is from/to the numbers in the request. A forged request fails here.
export async function verifyWebhook({ signature, url, params }) {
  if (config.twilio.authToken) {
    return twilio.validateRequest(config.twilio.authToken, signature || '', url, params);
  }
  if (!params.CallSid) return false;
  try {
    const c = await client.calls(params.CallSid).fetch();
    const live = ['queued', 'ringing', 'in-progress'].includes(c.status);
    const sameParties = (!params.From || c.from === params.From) && (!params.To || c.to === params.To);
    return live && sameParties && c.accountSid === config.twilio.accountSid;
  } catch {
    return false;
  }
}
