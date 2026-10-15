// Twilio Function: phone-number-level gate for your AI agent.
//
// Deploy it in Twilio (Functions and Assets → Services), then set your number's
// "A call comes in" to this Function. Unknown callers are rejected before the call
// is answered (no AI session starts, the call isn't billed as answered), even when
// your own server is offline.
//
// Edit the two constants below. Do NOT put API keys or tokens in this file.

const ALLOWED_CALLERS = ['+9715XXXXXXXX']; // your own number(s), E.164 format
const AGENT_WEBHOOK = 'https://YOUR-SUBDOMAIN.ngrok-free.app/twilio/voice';

exports.handler = function handler(context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  if (ALLOWED_CALLERS.includes(event.From)) {
    // Hand the call to the agent server (it re-checks the allowlist too).
    twiml.redirect({ method: 'POST' }, AGENT_WEBHOOK);
  } else {
    twiml.reject({ reason: 'rejected' });
  }
  callback(null, twiml);
};
