# Step 1: OpenAI account, billing and API key

You need one value from OpenAI: **`OPENAI_API_KEY`**. It pays for the voice (GPT-Live) and, optionally, the backup brain.

> ⏱ About 10 minutes. 💳 You need a debit or credit card. Websites change their menus from time to time: if a button has moved, look for the same words nearby.

## 1.1 Create the account

1. Open **https://platform.openai.com/signup**.
   (This is the *developer platform*. A ChatGPT Plus subscription is separate and does **not** include API credits.)
2. Sign up with your email, Google, Microsoft or Apple account.
3. If you used email: open the verification email and click the link.
4. Enter your name and birthday when asked. An organization is created for you automatically.

## 1.2 Add a payment method and credits

The API is pay-as-you-go: you buy credits up front and calls use them.

1. Click the **gear icon ⚙️ (Settings)** at the top right.
2. In the left menu, open **Billing**.
3. Click **Add payment details** → choose **Individual** (or **Company**) → enter your card → **Continue**.
4. Choose an amount of credits. **$10** is plenty for many hours of testing. The minimum is $5.
5. Leave **auto-recharge off** while you are learning. You can't overspend what you prepaid.
6. Optional but smart: **Settings → Limits** → set a monthly budget alert.

💡 **Cost guide:** GPT-Live costs about **$0.05 per minute** of call (billed per second). The backup brain model costs a few cents per question at most.

## 1.3 Create the API key

1. Go to **https://platform.openai.com/api-keys** (or Settings → **API keys**).
2. Click **+ Create new secret key**.
3. Fill in:
   - **Owned by:** You
   - **Name:** `calling-agent` (any name that reminds you what it is for)
   - **Project:** Default project
   - **Permissions:** All
4. Click **Create secret key**.
5. **Copy the key now.** It starts with `sk-` and is shown **only once**. If you lose it, delete it and create a new one.

## 1.4 Put it in `.env`

In the project folder:

```bash
cp .env.example .env
```

Open `.env` in any text editor and paste the key after the `=`, **without quotes**:

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
```

## 1.5 If a model says "not available"

`npm run doctor` (Step 4) checks that your key can use `gpt-live-1`. If it can't:

- Make sure you added credits (1.2). Free accounts can't use realtime voice models.
- Some newer models require **organization verification**: Settings → **Organization → General → Verify Organization**, then follow the ID check. It usually takes minutes.
- New accounts sometimes need a few minutes after the first payment.

## 🔐 Keep the key secret

- Never paste it into a chat, a video, a screenshot, a GitHub issue or the code.
- It only lives in `.env`, which is git-ignored.
- If it ever leaks, go to **API keys**, **delete** it, and create a new one. That instantly stops misuse.

➡️ Next: [Step 2: Twilio](02-twilio.md)

---
🎥 Built for the Arabic AI community by **Thaka2.ai (ذكاء)**. If this guide helped, [subscribe on YouTube](https://www.youtube.com/@Thakaa-AI) and visit [thaka2.ai](https://www.thaka2.ai).
