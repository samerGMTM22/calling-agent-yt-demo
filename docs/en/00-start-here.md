# Step 0: Start here (no coding experience needed)

This page is for you if you have never used a terminal, an API key or GitHub. Read it once; it explains every word the other guides use.

## What you are building

A phone number that belongs to your AI agent. You can call it and talk to it, and it can call you. OpenAI provides the voice, Twilio provides the phone line, and your AI agent (or an OpenAI model) is the brain that answers questions during the call. It runs on **your own computer** while you use it.

## Two ways to set it up

| | How | Best for |
|---|---|---|
| **A. With your AI agent (recommended)** | Open this folder in an AI agent that can run commands on your computer, such as **Claude Code** or **Codex**, and paste the prompt below. It reads [AGENTS.md](../../AGENTS.md) and guides you step by step. | Everyone, especially beginners |
| **B. By hand** | Follow Steps 1 to 8 below yourself. | People who like to see every step |

Either way, **you** create the accounts, enter payment details and paste your keys. The agent never does those for you, and you should never paste your keys into a chat.

### Copy-paste prompt for your agent

> Read AGENTS.md in this folder and help me set up the phone calling agent, step by step. First ask me whether I prefer Arabic or English. I am not technical: tell me exactly where to click and what to type, one step at a time. Never show my keys on screen and never ask me to paste them into the chat; tell me to put them in the .env file myself.

## What you need

| Item | Cost | Time |
|---|---|---|
| A computer (Mac, Windows or Linux) that stays awake during calls | | |
| Your mobile phone | | |
| A debit or credit card | | |
| OpenAI account with prepaid credits | $5–10 to start; ≈ $0.05 per call minute | 10 min |
| Twilio account, upgraded, with a phone number | ≈ $20 first top-up; ≈ $1.15/month for a US number, plus cents per minute | 20 min |
| Node.js, Git, free ngrok account | free | 15 min |

Total: about **45–60 minutes** the first time. A 3-minute test call costs roughly **$0.15–0.30**.

## Words you will meet

| Word | Meaning |
|---|---|
| **Terminal** | A window where you type commands instead of clicking. Mac: *Terminal*. Windows: *PowerShell* or *Terminal*. |
| **Command** | A line you type in the terminal and run with **Enter**, like `npm run doctor`. Copy it exactly. |
| **API key** | A long secret password that lets this program use your OpenAI or Twilio account. Anyone who has it can spend your money. |
| **`.env` file** | A small text file in this folder where your keys live. It never goes to GitHub. |
| **E.164** | The international phone format: `+`, country code, number, no spaces, no leading `0`. |
| **ngrok** | A free tool that gives your computer a temporary public web address, so Twilio can reach it. |
| **Webhook** | The web address Twilio calls when someone dials your number. `npm run twilio:connect` sets it for you. |
| **Fork / clone** | *Fork* = make your own copy on GitHub. *Clone* = download it to your computer. |

## Opening a terminal in this folder

**Mac**

1. Press **Cmd + Space**, type **Terminal**, press **Enter**.
2. Type `cd ` (with a space after it), then **drag the project folder** from Finder into the Terminal window, and press **Enter**.

**Windows**

1. Open the project folder in File Explorer.
2. Click the address bar at the top, type **powershell**, press **Enter**. A PowerShell window opens already inside the folder.

Check you are in the right place: type `ls` (Mac) or `dir` (Windows) and press Enter. You should see `README.md` and `package.json` in the list.

## Creating and editing `.env`

Files starting with a dot are hidden by default.

- **Show hidden files:** Mac Finder: press **Cmd + Shift + .** (period). Windows File Explorer: **View → Show → Hidden items**.

Create your `.env` from the template (run in the project folder):

| System | Command |
|---|---|
| Mac / Linux | `cp .env.example .env` |
| Windows PowerShell | `Copy-Item .env.example .env` |
| Windows Command Prompt | `copy .env.example .env` |

Open it to edit:

| System | Command |
|---|---|
| Mac | `open -e .env` (opens TextEdit) |
| Windows | `notepad .env` |

Rules for `.env`:

- One setting per line: `NAME=value`. **No quotes, no spaces around `=`, no commas at the end.**
- Paste each key right after the `=`, for example `OPENAI_API_KEY=sk-proj-abc123…`
- Save the file. In Notepad, keep the name `.env` (not `.env.txt`): choose **Save as type: All files**.
- Never send this file to anyone, never upload it, never show it on a screen recording.

## Phone numbers in E.164 format

Write every phone number as `+` country code, then the number **without the leading 0** and **without spaces or dashes**:

| You dial at home | E.164 |
|---|---|
| UAE mobile `05X XXX XXXX` | `+9715XXXXXXXX` |
| Saudi mobile `05X XXX XXXX` | `+9665XXXXXXXX` |
| Egypt mobile `01X XXXX XXXX` | `+201XXXXXXXXX` |
| US `(555) 123-4567` | `+15551234567` |

## Your path

| Step | Guide | You end up with |
|---|---|---|
| 1 | [OpenAI](01-openai.md) | `OPENAI_API_KEY` |
| 2 | [Twilio](02-twilio.md) | Account SID, API key + secret, phone number |
| 3 | [Node.js, Git and ngrok](03-ngrok.md) | The project on your computer, ngrok connected |
| 4 | [Run it and call](04-run-and-call.md) | Your first call |
| 5 | [Security and compliance](05-security-and-compliance.md) | A locked-down number |
| 6 | [How it works](06-how-it-works.md) | Optional reading |
| 7 | [Troubleshooting](07-troubleshooting.md) | Fixes for common errors |
| 8 | [Customize the persona](08-customize-persona.md) | Your agent's name, voice and personality |

After every step you can run `npm run doctor`: it checks your setup and tells you, in plain words, what to fix next.

## Five-minute safety checklist (before your first call)

- [ ] `.env` holds your keys and nothing else does (not a note, not a chat, not a screenshot).
- [ ] `OWNER_PHONE_NUMBER` is your own mobile, in E.164.
- [ ] `INBOUND_PIN` is set to a 4–10 digit PIN only you know (callers type it before the agent answers).
- [ ] OpenAI auto-recharge is **off** and a budget alert is set; Twilio geo permissions allow only the countries you need.
- [ ] If you record your screen: hide `.env`, your ngrok address and your phone numbers.

## Stuck?

1. Run `npm run doctor` and read the ❌ lines.
2. Check [Troubleshooting](07-troubleshooting.md).
3. Ask your AI agent: *"npm run doctor says … what should I do?"* (it can see the output; you don't need to share keys).

➡️ Next: [Step 1: OpenAI](01-openai.md)

---
🎥 Learn AI agents in Arabic: [Thaka2.ai on YouTube](https://www.youtube.com/@Thakaa-AI) · [thaka2.ai](https://www.thaka2.ai)
