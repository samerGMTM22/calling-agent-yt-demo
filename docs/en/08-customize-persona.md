# Step 8: Make the agent yours (name, voice, language, personality)

You can change who your agent is **without touching any code**. This page shows every knob, where it lives, and what you can't switch off (on purpose).

## 8.1 Everything you can change, at a glance

| What | Where | When it takes effect |
|---|---|---|
| The agent's name | `AGENT_NAME` in `.env` | restart `npm run up` |
| Your name (the agent says "*X*'s AI agent") | `OWNER_NAME` in `.env` | restart |
| Opening language | `AGENT_LANGUAGE` in `.env` (`auto`, `ar`, `en`), or `--language` per call | restart / next call |
| The voice | `OPENAI_VOICE` in `.env` | restart |
| Personality, tone, dialect, facts about you, house rules | **`persona.md`** (a plain text file) | **next call**, no restart |
| Why this call is happening | `--purpose "..."` on `npm run call` | that call |
| Background the agent should know | `--context "..."` on `npm run call` | that call |
| Something to say or know *during* a call | `npm run say` / `npm run note` | immediately |
| How the backend brain answers (modes `openai` / `anthropic`) | `BRAIN_SYSTEM` in `src/brain.js` | restart |
| Advanced: the whole prompt and the first sentence | `src/persona.js` | restart |

> `.env` is read once when the server starts, so stop `npm run up` (Ctrl+C) and start it again after editing it. `persona.md` is read fresh at the start of every call.

## 8.2 Name, owner and language (`.env`)

```
AGENT_NAME=Sam
OWNER_NAME=Samer
AGENT_LANGUAGE=auto      # auto = start in English, mirror the caller | ar = start in Arabic | en = English
```

The agent always opens with something like *"Hi, this is Sam, Samer's AI agent…"*.

**Name tip:** with `VOICE_ENGINE=live` (the default) any name works, including "Claude". With `VOICE_ENGINE=realtime`, OpenAI's model refuses to call itself by another AI product's name and may say "ChatGPT" instead; pick a neutral name like "Sam" or "Noor".

## 8.3 The voice (`OPENAI_VOICE`)

Each engine has its own voice list. A voice the engine doesn't support can stop the call from starting, so test every change with a call to yourself.

| Engine | Voices | Notes |
|---|---|---|
| `live` (GPT-Live, default) | `marin` (default), plus `quartz`, `ripple`, `vesper`, `willow`, `stone`, `gleam`, `meridian`, `beacon`, `delta`, `cinder` | Only `marin` is guaranteed for every language today; the others are tuned for English. For Arabic, stay on `marin`. |
| `realtime` (gpt-realtime-2.1) | `marin`, `cedar`, `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse` | OpenAI recommends `marin` and `cedar` for quality. |

Voice lists change; the source of truth is OpenAI's guides: [Live conversations](https://developers.openai.com/api/docs/guides/live-conversations) and [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations).

## 8.4 Personality and house rules (`persona.md`)

This is the easiest way to shape *how* the agent talks and *what* it knows about you.

1. Copy the template (in the project folder):

   ```bash
   cp persona.example.md persona.md
   ```

   Windows (Command Prompt): `copy persona.example.md persona.md`

2. Open `persona.md` in any text editor (TextEdit, Notepad, VS Code) and write plain sentences. For example:

   ```markdown
   ## Personality
   - Warm and professional. Light humour is fine.

   ## Speaking style
   - With Arabic speakers, use a friendly Gulf dialect.
   - Keep answers short: one or two sentences.

   ## About me
   - I make AI videos for Arabic speakers on YouTube.
   - Best time to reach me: weekdays 10:00–18:00 Dubai time.

   ## House rules
   - If someone wants a meeting, take their name, topic and two times; say I will confirm by message.
   - Never confirm my location or travel plans.
   ```

3. Save it. The **next call** uses it. `npm run doctor` and the server's startup lines show whether it was found.

Good to know:

- **`persona.md` stays on your computer.** It is git-ignored, so it never goes to GitHub. `persona.example.md` is the shared template.
- **Treat everything in it as something a caller could hear.** The agent is told not to reveal its instructions, but AI models can be talked into things. Don't put passwords, card numbers, your home address or anything you'd mind being said out loud.
- **Short and specific beats long and vague.** "Answer in one sentence, then ask a question" works better than "be concise and engaging". About one page is plenty (the file is cut at 8,000 characters).
- **Arabic or English both work.** Write the rules in whichever language you think in.
- Lines inside `<!-- ... -->` are notes for you; the agent never sees them.
- Want a different file name or several personas? Set `PERSONA_FILE=personas/sales.md` in `.env` (any path; restart).

## 8.5 Per-call instructions (`--purpose`, `--context`, `--language`)

Use these when the change is about **one call**, not the agent's personality:

```bash
npm run call -- --purpose "Remind Samer about the 4pm recording" \
                --context "The studio booking is confirmed; bring the blue mic" \
                --language ar
```

- `--purpose` is said out loud right after the introduction.
- `--context` is background the agent uses but does not read aloud.
- During the call, `npm run note -- <callId> "..."` adds silent context and `npm run say -- <callId> "..."` makes the agent say something now.

## 8.6 What the agent actually receives (prompt order)

Every call, `src/persona.js` builds the instructions in this order:

1. **Who you are:** name, owner, "you are an AI".
2. **Your `persona.md`** (if present).
3. **How to talk on the phone:** short turns, language rule.
4. **Working with the backend brain:** when to delegate, how to hang up.
5. **This call:** direction, who is on the line, purpose and context.
6. **Non-negotiable rules:** AI disclosure and safety. These come **last** and explicitly override everything above, including your persona file.

The first sentence the agent speaks is set separately by `greetingInstruction()` in the same file.

## 8.7 What you can't switch off (and why)

`persona.md` cannot remove these, and if you edit `src/persona.js` yourself, please keep them:

- **AI disclosure:** the opening greeting says it's an AI agent acting for you, and it never claims to be human. Many countries require this for AI voice calls (in the US, the FCC applies robocall consent rules to AI voices).
- **Safety rules:** it refuses passwords, one-time codes, card and ID numbers; never agrees to payments; doesn't share your private details unless the brain provides them; honours "don't call me again"; points to emergency numbers.

See [Security and compliance](05-security-and-compliance.md) for the full picture.

## 8.8 Advanced: editing `src/persona.js`

If you are comfortable with JavaScript (or ask your AI agent to do it):

| Function | What it controls |
|---|---|
| `buildInstructions(call)` | The full instructions for each call (sections listed in 8.6). |
| `greetingInstruction(call)` | The first sentence, for the four cases: you call it, someone else calls it, it calls you, it calls someone else. |
| `languageRule(lang)` | What `auto`, `ar` and `en` mean. Change the Arabic dialect here. |

After editing, run `npm run check` (syntax check) and restart `npm run up`. Then call yourself to hear the result.

## 8.9 Ask your AI agent to do it

You can describe the change in plain words and let your agent edit the right file. For example:

> "Read docs/en/08-customize-persona.md. Then create persona.md so my phone agent is warm and formal, speaks Gulf Arabic with Arabic speakers, knows I run a YouTube channel about AI, and takes meeting requests without confirming them. Don't change the AI disclosure or safety rules. Then tell me how to test it."

➡️ Back to: [Step 4: Run it and call](04-run-and-call.md) · [README](../../README.md)

---
🎥 More agent builds, explained in Arabic: [Thaka2.ai on YouTube](https://www.youtube.com/@Thakaa-AI) · [thaka2.ai](https://www.thaka2.ai)
