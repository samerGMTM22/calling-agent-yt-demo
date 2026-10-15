# Step 3: Install Node.js, Git and ngrok

Your computer runs the agent's server. Twilio needs a public **https** address to reach it; **ngrok** creates one that tunnels to your computer.

## 3.1 Node.js (version 20 or newer)

- **macOS:** download the **LTS** installer from https://nodejs.org, or run `brew install node`.
- **Windows:** download the **LTS** `.msi` from https://nodejs.org and click through the installer.
- **Linux:** use https://nodejs.org/en/download (nvm is easiest).

Check it worked (open a new terminal):

```bash
node -v
```

You should see `v20` or higher.

## 3.2 Git and the project

Install Git from https://git-scm.com/downloads (macOS: it is offered automatically the first time you type `git`).

Get the code. **Fork** it on GitHub first if you want your own copy, then:

```bash
git clone https://github.com/samerGMTM22/calling-agent-yt-demo.git
cd calling-agent-yt-demo
npm install
```

## 3.3 ngrok account and authtoken

1. Sign up (free) at **https://dashboard.ngrok.com/signup**.
2. Install ngrok:
   - macOS: `brew install ngrok`
   - Windows: `winget install ngrok.ngrok` (or download from https://ngrok.com/download)
   - Linux: see https://ngrok.com/download
3. In the ngrok dashboard open **Getting Started → Your Authtoken** and copy the token.
4. Connect ngrok to your account (one time):

```bash
ngrok config add-authtoken PASTE_YOUR_NGROK_TOKEN_HERE
```

The ngrok token is also a secret. It is stored in ngrok's own config file, not in this project.

## 3.4 Optional: a free static domain (recommended)

By default ngrok gives you a new random address every time, which means re-pointing Twilio after each restart. A free **static domain** fixes that:

1. ngrok dashboard → **Domains** (or **Universal Gateway → Domains**) → **+ New Domain / Create domain**.
2. Copy it (e.g. `my-agent.ngrok-free.app`) into `.env`:

```
NGROK_DOMAIN=my-agent.ngrok-free.app
```

`npm run up` uses it automatically.

➡️ Next: [Step 4: Run it and make your first call](04-run-and-call.md)

---
🎥 **Thaka2.ai (ذكاء)**: [YouTube](https://www.youtube.com/@Thakaa-AI) · [thaka2.ai](https://www.thaka2.ai)
