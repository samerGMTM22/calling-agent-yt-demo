# Troubleshooting

Start with `npm run doctor`. It checks every step and prints the fix.

| Symptom | Likely cause → fix |
|---|---|
| `accountSid must start with AC` | The value in `.env` has quotes/commas or is the wrong field. Paste only `AC…`, no quotes. |
| Twilio `20003` / `401` | Wrong API key SID/secret pair, or the key was deleted. Create a new **Standard** key. |
| Twilio `21215` / "geo permission" | The destination country is not enabled: Voice → Settings → **Geo permissions**. |
| Twilio `21219` (trial) | Trial accounts can only call **Verified Caller IDs**. Verify the number or upgrade. |
| "This is a trial account…" message | Normal on trial. Press any key, or upgrade the account. |
| Call connects, then silence and hangs up | Server not reachable: is `npm run up` running? Does `npm run status` show a public URL? Is the number's webhook the **current** ngrok URL (`npm run twilio:connect`)? |
| Your own call is rejected | Your number in `.env` must match exactly in E.164 (`+9715…`, no spaces or leading zeros). Check `npm run status`. If your number uses a Twilio Function gate, add the number there too. |
| `No public URL` | Start ngrok (`npm run up` does it) or set `PUBLIC_URL`. |
| ngrok `ERR_NGROK_4018` | Add your authtoken: `ngrok config add-authtoken …` |
| OpenAI `401` | Wrong or deleted key. Create a new one. |
| OpenAI model "not found" / no access | Add credits, wait a few minutes, or verify your organization (Settings → Organization). |
| Agent doesn't answer delegated questions | In `BRAIN_MODE=agent` someone must run `npm run watch` and `npm run answer`. Otherwise the fallback answers after `BRAIN_TIMEOUT_SECONDS`. |
| Brain answers slowly | Lower `BRAIN_TIMEOUT_SECONDS`, or use `BRAIN_MODE=openai` with a faster `OPENAI_BRAIN_MODEL`. |
| Agent replies in the wrong language | Set `AGENT_LANGUAGE=ar` (or `en`), or pass `--language ar` to `npm run call`. |
| On `VOICE_ENGINE=realtime` the agent calls itself "ChatGPT" | OpenAI's realtime model avoids using another AI product's name (e.g. "Claude"). Use a neutral `AGENT_NAME` like "Sam", or stay on `VOICE_ENGINE=live`. |
| Choppy audio | Check your internet upload speed; close heavy apps; keep the laptop awake. |

## Logs

The server terminal prints one line per important event (masked phone numbers, no secrets). `npm run watch` shows the full live event feed. Finished calls are in `calls/*.json`.

---
🎥 Stuck? Comment on the video at [Thaka2.ai on YouTube](https://www.youtube.com/@Thakaa-AI), or visit [thaka2.ai](https://www.thaka2.ai).
