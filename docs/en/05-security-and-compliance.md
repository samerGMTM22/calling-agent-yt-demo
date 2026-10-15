# Step 5: Security and compliance

A phone number connected to an AI is connected to **your credit card**. Anyone who can reach it can spend your OpenAI and Twilio balance, and a careless agent could call people who never agreed to talk to an AI. This page covers what is built in and what you should add.

## Built in (on by default)

| Protection | What it does | Setting |
|---|---|---|
| **Inbound caller allowlist** | Only listed numbers reach the agent. Everyone else gets `<Reject>` *before* the call is answered: no AI session starts and the call isn't billed as answered. | `ALLOWED_CALLERS` (defaults to `OWNER_PHONE_NUMBER`; empty = reject all) |
| **Outbound destination allowlist** | Your agent can only dial numbers you listed, even if it is told (or tricked) to call someone else. | `ALLOWED_DESTINATIONS` (defaults to `ALLOWED_CALLERS`) |
| **Mandatory AI disclosure** | The agent's first sentence on every call says it is an AI agent acting for you, and it never claims to be human. | `src/persona.js` |
| **Webhook authenticity** | Requests to `/twilio/voice` are checked: by Twilio signature if `TWILIO_AUTH_TOKEN` is set, otherwise by confirming the call with Twilio's API. Forged requests get 403. | automatic |
| **One-time stream tokens** | The audio WebSocket only accepts a stream carrying a random, single-use token issued for that exact call, valid for 3 minutes. Nobody else can open AI sessions on your key. | automatic |
| **Local-only control API** | Placing calls and answering questions happens on `127.0.0.1:CONTROL_PORT`, which is **never** exposed through ngrok. | `CONTROL_PORT` |
| **Cost caps** | Every call is cut at `MAX_CALL_SECONDS` (default 10 min); at most `MAX_CONCURRENT_CALLS` at once. | `.env` |
| **API key, not master token** | Twilio access uses a revocable API key. | `TWILIO_API_KEY_*` |
| **Secrets stay local** | `.env`, transcripts (`calls/`) and backups (`data/`) are git-ignored. | `.gitignore` |
| **Safety rules in the prompt** | The agent refuses passwords, OTP codes and card numbers, never agrees to payments, and honours "don't call me again". | `src/persona.js` |

## Phone-number-level security (strongly recommended)

The server's allowlist only works while the server is running and pointed to. Add a second gate **inside Twilio** so that unknown callers are rejected even if your server is down or misconfigured:

**Option A: Twilio Function gate (what the author uses).** A tiny Twilio Function receives every call to your number, rejects unknown callers, and redirects allowed callers to your agent. Template: [`examples/twilio-gate-function.js`](../../examples/twilio-gate-function.js).

1. Twilio Console → **Functions and Assets → Services → Create Service** (e.g. `inbound-gate`).
2. **Add → Add Function**, path `/gate`, paste the template, set your number and your agent URL.
3. **Deploy All**.
4. Phone Numbers → your number → "A call comes in" → **Function** → your service → `/gate` → Save.

**Option B: Geo permissions.** Voice → Settings → **Geo permissions**: enable only the countries you call. This stops toll fraud to premium numbers abroad.

**Option C: Spending alerts.** Twilio: **Admin → Account billing → Usage triggers/alerts**. OpenAI: **Settings → Limits** → budget alerts. Keep auto-recharge off while experimenting.

## Compliance: voice AI rules of the road

Laws differ by country, and this is not legal advice. These habits keep you on the safe side almost everywhere:

1. **Always disclose the AI.** The agent introduces itself as *"<name>, <owner>'s AI agent"* on every call (built in; don't remove it). In the US, the FCC treats AI-generated voices as "artificial" voices under the TCPA, so unsolicited AI calls need the recipient's **prior express consent**.
2. **Only call people who expect it.** Call yourself, your team, or people who agreed to receive AI calls. No cold calling, no marketing blasts, no robocalls.
3. **Never impersonate.** The agent must not pretend to be you or any real person, and must not clone anyone's voice without consent.
4. **Recording and transcripts.** This project does **not** record audio. It stores **text transcripts** locally (`SAVE_TRANSCRIPTS=true`). Many places require telling people a call is recorded or transcribed; set `SAVE_TRANSCRIPTS=false` if you don't need them, and delete old files in `calls/`.
5. **Respect opt-outs.** If someone says "don't call me again", the agent apologises and ends the call. Remove the number from `ALLOWED_DESTINATIONS`.
6. **Calling hours.** Don't call people at night or on their rest days.
7. **No sensitive data.** The agent refuses passwords, OTP codes, card and ID numbers. Don't give it private data it doesn't need.
8. **Emergencies.** The agent is not an emergency service and tells people to hang up and call their local emergency number.

## If something leaks

| Leaked | Do this now |
|---|---|
| OpenAI key | platform.openai.com → API keys → **Delete** → create a new one |
| Twilio API key secret | Console → API keys & tokens → **Delete** the key → create a new one |
| Twilio Auth Token | Console → API keys & tokens → **Rotate/Request a secondary token** → promote it |
| ngrok token | ngrok dashboard → Authtokens → **Reset** |

Then check usage pages on both sites for unexpected activity.

## For AI agents operating this repo

See [AGENTS.md](../../AGENTS.md). The short version: never print or commit `.env` values, never widen allowlists or use `*` without the owner's explicit OK in the conversation, never place a call the owner didn't ask for, and never remove the AI disclosure.

---
🎥 More secure agent builds, explained in Arabic: [Thaka2.ai on YouTube](https://www.youtube.com/@Thakaa-AI) · [thaka2.ai](https://www.thaka2.ai)
