# Step 4: Run it, call it, and let it call you

## 4.1 Finish `.env`

At minimum you now have:

```
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_API_KEY_SID=SK...
TWILIO_API_KEY_SECRET=...
TWILIO_PHONE_NUMBER=+1...
OWNER_PHONE_NUMBER=+971...
```

Then personalise who the agent is:

```
AGENT_NAME=Sam
OWNER_NAME=Samer
AGENT_LANGUAGE=auto      # auto | ar | en
```

The agent will always open with: *"Hi, this is Sam, Samer's AI agent…"*

Recommended: a keypad PIN for calls **to** the agent. Pick 4–10 digits that only you know (not your birthday, not `1234`) and write them after the `=`:

```
INBOUND_PIN=
```

Want to change the voice, dialect or personality? See [Step 8: Customize the persona](08-customize-persona.md).

## 4.2 Check everything

```bash
npm run doctor
```

Every line should be ✅ (⚠️ lines are advice). Each ❌ tells you exactly what to fix.

## 4.3 Start the server

```bash
npm run up
```

This starts ngrok (if not already running) and the server. Keep this terminal open. You will see something like:

```
Agent           Sam, Samer's AI agent | persona: persona.md
Public URL      https://my-agent.ngrok-free.app
Inbound webhook https://my-agent.ngrok-free.app/twilio/voice
```

> 🎥 Recording your screen? A random ngrok address like `1a2b-203-0-113-10.ngrok-free.app` contains your IP address. Hide this terminal, or use a free static domain (`NGROK_DOMAIN`, [Step 3.4](03-ngrok.md#34-optional-a-free-static-domain-recommended)).

## 4.4 Let the agent call you (outbound)

In a **second terminal**:

```bash
npm run call -- --purpose "Say hi and check that the phone agent works"
```

With no `--to`, it calls `OWNER_PHONE_NUMBER`. To call another number, it must be in `ALLOWED_DESTINATIONS` (see Security), then:

```bash
npm run call -- --to +15551234567 --purpose "Confirm Thursday's meeting at 3pm" --context "Samer is free Thursday after 2pm"
```

- `--purpose`: why the agent is calling (it says this after introducing itself)
- `--context`: background the agent should know but not read aloud
- `--language ar` or `--language en`: language to open with

## 4.5 Call the agent (inbound)

Point your Twilio number at the server (one time, or after each ngrok restart unless you use a static domain):

```bash
npm run twilio:connect            # shows the current setting, changes nothing
npm run twilio:connect -- --apply # points the number at this server (saves a backup)
```

Now call your Twilio number **from your own phone**. Calls from any number not in `ALLOWED_CALLERS` are rejected before they are answered. If you set `INBOUND_PIN`, you'll hear "Please enter your PIN": type it on the keypad (3 tries).

To put the previous setting back: `npm run twilio:connect -- --restore`.

> You can also do it by hand: Twilio Console → Phone Numbers → Manage → Active numbers → click your number → **Voice Configuration** → "A call comes in" → **Webhook** → paste `https://YOUR-URL/twilio/voice` → **HTTP POST** → **Save configuration**.

## 4.6 Be the brain (for you or your AI agent)

The voice model handles the conversation. When it needs facts, a decision, or anything it shouldn't guess, it **delegates** to the brain. With `BRAIN_MODE=agent` the brain is whoever is watching:

```bash
npm run watch
```

Each event is one JSON line. When you see `"type":"brain.question"`, answer within `BRAIN_TIMEOUT_SECONDS` (default 30):

```bash
npm run answer -- q_abc123 "Yes, Thursday at 3pm works. Samer will bring the slides."
```

Add `--hangup` to end the call after the answer is spoken. If nobody answers in time, `BRAIN_FALLBACK` (an OpenAI model by default) answers instead, so the caller is never left hanging.

Other live controls:

```bash
npm run say -- call_abc123 "Tell them Samer just joined and says hi"   # agent says this now
npm run note -- call_abc123 "The caller is Samer's accountant"         # silent context
npm run hangup -- call_abc123
npm run calls                       # list calls
npm run transcript -- call_abc123   # full transcript + brain Q&A
npm run status                      # engine, brain, URLs, allowlists
```

Transcripts are saved in `./calls/` (git-ignored).

**Hanging up:** say "goodbye" or "you can hang up". The voice says goodbye and asks the brain, which hangs up (answer with `--hangup` if you are the brain). You can always just hang up your phone.

> The `npm run` commands talk to the server with a secret token it writes to `data/control-token` at every start. Run them from the project folder. If you get `401`, the server restarted or you are in another folder.

## 4.7 Choose the voice engine and brain

| Setting | Options | Notes |
|---|---|---|
| `VOICE_ENGINE` | `live` (default), `realtime` | `live` = GPT-Live, full-duplex and most natural. `realtime` = gpt-realtime-2.1, turn-based. |
| `OPENAI_VOICE` | `marin` (default), `cedar`, … | OpenAI recommends `marin`/`cedar` for quality. |
| `BRAIN_MODE` | `agent`, `openai`, `anthropic`, `none` | Who answers delegated questions. |
| `BRAIN_FALLBACK` | `openai`, `anthropic`, `none` | Used when the agent doesn't answer in time. |

➡️ Next: [Step 5: Security and compliance](05-security-and-compliance.md) (please read it before sharing your number with anyone)

---
🎥 Enjoying this? [Subscribe to Thaka2.ai on YouTube](https://www.youtube.com/@Thakaa-AI) for more agent builds in Arabic. Website: [thaka2.ai](https://www.thaka2.ai)
